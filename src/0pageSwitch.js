;(function ($, ns) {
    'use strict';
    // 共享变量
    var divstyle=$('<div />')[0].style,
        class2type = {},
        camelCase = function (str){
            return (str+'').replace(/^-ms-/, 'ms-').replace(/-([a-z]|[0-9])/ig, function(all, letter){
                return (letter+'').toUpperCase();
            });
        },
        cssVendor=function(){
            var tests="-webkit- -moz- -o- -ms-".split(" "),
                prop;
            while(prop=tests.shift()){
                if(camelCase(prop+'transform') in divstyle){
                    return prop;
                }
            }
            return '';
        }(),
        cssTest = function (name){
            var prop=camelCase(name),
                _prop=camelCase(cssVendor+prop);
            return (prop in divstyle) && prop || (_prop in divstyle) && _prop || '';
        },
        opacity=cssTest('opacity'),
        transform=cssTest('transform'),
        perspective=cssTest('perspective'),
        TRANSITION = {
            /* 更改切换效果
             * @param Element cpage 当前页面
             * @param Float cp      当前页面过度百分比
             * @param Element tpage 前序页面
             * @param Float tp      前序页面过度百分比
             */
            fade:function(cpage,cp,tpage,tp){
                if(opacity){
                    cpage.style.opacity=1-Math.abs(cp);
                    if(tpage){
                        tpage.style.opacity=Math.abs(cp);
                    }
                }else{
                    cpage.style.filter='alpha(opacity='+(1-Math.abs(cp))*100+')';
                    if(tpage){
                        tpage.style.filter='alpha(opacity='+Math.abs(cp)*100+')';
                    }
                }
            }
        };

    // 构造函数
    function PageSwitch(config) {
        this.init($.extend({
            // defaultConfig
            mousewheel: true, // 是否支持鼠标滚轮滚动
            mouse: true, // 是否支持鼠标滚动
            arrowkey:true, // 是否支持键盘方向箭头
            direction: 0, // 方向: 0 代表向上 1 代表 向下 todo
            duration: 600, // 动画持续时间
            interval: 5000, // ？？ todo
            start:0, // 从第几页开始
            loop: true, // 默认循环滚动
            autoplay: true, // 是否自动播放
            freeze: false, // ？？？ todo
            transition: 'slide', // 默认 slide
            container: '#pages', // 容器选择器
        }, config));
    }

    // 原型方法 doing 把作者自己写的方法用zepto方法替换 私有方法下划线
    PageSwitch.prototype = {
        constructor: PageSwitch,
        latestTime:0,
        _STARTEVENT: [],
        _MOVEEVENT: [],
        _POINTERTYPES: {
            2:'touch',
            3:'pen',
            4:'mouse',
            pen:'pen'
        },
        _POINTERS: {
            touch:{},
            pointer:{},
            mouse:{}
        },
        _defaultStyle: {
            position:'absolute',
            top:0,
            left:0,
            width:'100%',
            height:'100%',
            display:'none'
        },
        class2type: {},
        _event2type: {},
        _event2code: {
            click:4,
            mousewheel:5,
            dommousescroll:5,
            keydown:6
        },

        _EVENT: function () {
            var that = this,
                ret={},
                states={
                    start:1,
                    down:1,
                    move:2,
                    end:3,
                    up:3,
                    cancel:3
                };

            $.each("mouse touch pointer MSPointer-".split(" "),function(index, prefix){
                var _prefix=/pointer/i.test(prefix)?'pointer':prefix;
                ret[_prefix]=ret[_prefix]||{};
                that._POINTERTYPES[_prefix]=_prefix;
                $.each(states, function(endfix, code){
                    var ev = camelCase(prefix+endfix);
                    ret[_prefix][ev]=code;
                    that._event2type[ev.toLowerCase()]=_prefix;
                    that._event2code[ev.toLowerCase()]=code;
                    if(code==1){
                        that._STARTEVENT.push(ev);
                    }else{
                        that._MOVEEVENT.push(ev);
                    }
                });
            });
            return ret;
        },
        _EASE: {
            linear:function(t,b,c,d){ return c*t/d + b; },
            ease:function(t,b,c,d){ return -c * ((t=t/d-1)*t*t*t - 1) + b; },
            'ease-in':function(t,b,c,d){ return c*(t/=d)*t*t + b; },
            'ease-out':function(t,b,c,d){ return c*((t=t/d-1)*t*t + 1) + b; },
            'ease-in-out':function(t,b,c,d){ if ((t/=d/2) < 1) return c/2*t*t*t + b; return c/2*((t-=2)*t*t + 2) + b; },
            bounce:function(t,b,c,d){ if ((t/=d) < (1/2.75)) { return c*(7.5625*t*t) + b; } else if (t < (2/2.75)) { return c*(7.5625*(t-=(1.5/2.75))*t + .75) + b; } else if (t < (2.5/2.75)) { return c*(7.5625*(t-=(2.25/2.75))*t + .9375) + b; } else { return c*(7.5625*(t-=(2.625/2.75))*t + .984375) + b; } }
        },

        _pointerItem: function (obj,n){
            return 'item' in obj?obj.item(n):function(){
                var i=0,key;
                for(key in this){
                    if(i++==n){
                        return this[key];
                    }
                }
            }.call(obj,n);
        },
        _pointerLength: function (obj){
            var len=0,key;
            if(typeof obj.length ==='number'){
                len=obj.length;
            }else if('keys' in Object){
                len=Object.keys(obj).length;
            }else{
                for(key in obj){
                    if(obj.hasOwnProperty(key)){
                        len++;
                    }
                }
            }
            return len;
        },
        _filterEvent: function (oldEvent){
            var ev={},
                which=oldEvent.which,
                button=oldEvent.button,
                pointers,pointer;

            $.each(['wheelDelta', 'detail', 'which', 'keyCode'], function(index, prop){
                ev[prop]=oldEvent[prop];
            });

            ev.oldEvent=oldEvent;

            ev.type=oldEvent.type.toLowerCase();
            ev.eventType=this._event2type[ev.type]||ev.type;
            ev.eventCode=this._event2code[ev.type]||0;
            ev.pointerType=this._POINTERTYPES[oldEvent.pointerType]||oldEvent.pointerType||ev.eventType;

            ev.target=oldEvent.target||oldEvent.srcElement||DOC.documentElement;
            if(ev.target.nodeType===3){// 文本节点
                ev.target=ev.target.parentNode;
            }

            ev.preventDefault=function(){
                oldEvent.preventDefault && oldEvent.preventDefault();
                ev.returnValue=oldEvent.returnValue=false;
            }

            if(pointers=this._POINTERS[ev.eventType]){
                switch(ev.eventType){
                    case 'mouse':
                    case 'pointer':
                        var id=oldEvent.pointerId||0;
                        ev.eventCode==3?delete pointers[id]:pointers[id]=oldEvent;
                        break;
                    case 'touch':
                        this._POINTERS[ev.eventType]=pointers=oldEvent.touches;
                        break;
                }

                if(pointer=this._pointerItem(pointers,0)){
                    ev.clientX=pointer.clientX;
                    ev.clientY=pointer.clientY;
                }

                ev.button=which<4?Math.max(0,which-1):button&4&&1||button&2; // left:0 middle:1 right:2
                ev.length=this._pointerLength(pointers);
            }

            return ev;
        },
        initTRANSITION: function () {
            $.each(["Boolean", "Number", "String", "Function", "Array", "Date", "RegExp", "Object", "Error"],function(i, name){
                class2type["[object "+name+"]"]=name.toLowerCase();
            });

            $.each(['X', 'Y'],function(i, name){
                var XY={X:'left',Y:'top'},
                    fire3D=perspective?' translateZ(0)':'';

                // TRANSITION['scroll'+name]=function(cpage,cp,tpage,tp){
                //     var prop=name||['X','Y'][this.direction];
                //     transform?cpage.style[transform]='translate'+prop+'('+cp*100+'%)'+fire3D:cpage.style[XY[prop]]=cp*100+'%';
                //     if(tpage){
                //         transform?tpage.style[transform]='translate'+prop+'('+tp*100+'%)'+fire3D:tpage.style[XY[prop]]=tp*100+'%';
                //     }
                // }

                // TRANSITION['scroll3d'+name]=function(cpage,cp,tpage,tp){
                //     var prop=name||['X','Y'][this.direction],
                //         fix=cp<0?-1:1,
                //         abscp=Math.abs(cp),
                //         deg;
                //     if(perspective){
                //         if(abscp<.05){
                //             deg=abscp*1200;
                //             cp=0;tp=fix*-1;
                //         }else if(abscp<.95){
                //             deg=60;
                //             cp=(cp-.05*fix)/.9;
                //             tp=(tp+.05*fix)/.9;
                //         }else{
                //             deg=(1-abscp)*1200;
                //             cp=fix;tp=0;
                //         }
                //         cpage.parentNode.style[transform]='perspective(1000px) rotateX('+deg+'deg)';
                //         cpage.style[transform]='translate'+prop+'('+cp*100+'%)';
                //         if(tpage){
                //             tpage.style[transform]='translate'+prop+'('+tp*100+'%)';
                //         }
                //     }else TRANSITION['scroll'+name].apply(this,arguments);
                // }

                // TRANSITION['slide'+name]=function(cpage,cp,tpage,tp){
                //     TRANSITION['slideCoverReverse'+name].apply(this,arguments);
                // }

                // TRANSITION['flow'+name]=function(cpage,cp,tpage,tp){
                //     TRANSITION['flowCoverIn'+name].apply(this,arguments);
                // }

                // TRANSITION['slice'+name]=function(){
                //     var createWrap=function(node,container){
                //             var wrap=DOC.createElement('div');
                //             wrap.style.cssText='position:absolute;top:0;left:0;height:100%;width:100%;overflow:hidden;';
                //             wrap.appendChild(node);
                //             container.appendChild(wrap);
                //         },
                //         fixBlock=function(cpage,tpage,pages,container){
                //             each(pages,function(page){
                //                 if(page.parentNode==container)return;
                //                 if(cpage!=page && tpage!=page){
                //                     page.parentNode.style.display='none';
                //                 }else{
                //                     page.parentNode.style.display='block';
                //                 }
                //             });
                //         };

                //     return function(cpage,cp,tpage,tp){
                //         var prop=name||['X','Y'][this.direction],
                //             len=prop=='X'?'width':'height',
                //             total=this.container[camelCase('client-'+len)],
                //             m=Math.abs(cp)*100,
                //             n=Math.abs(tp)*100,
                //             end=cp==0||tp==0;

                //         cpage.style[len]=end?'100%':total+'px';
                //         if(cpage.parentNode==this.container){
                //             createWrap(cpage,this.container);
                //         }
                //         cpage.parentNode.style.zIndex=cp>0?0:1;
                //         cpage.parentNode.style[len]=(Math.min(cp,0)+1)*100+'%';

                //         if(tpage){
                //             tpage.style[len]=end?'100%':total+'px';
                //             if(tpage.parentNode==this.container){
                //                 createWrap(tpage,this.container);
                //             }
                //             tpage.parentNode.style.zIndex=cp>0?1:0;
                //             tpage.parentNode.style[len]=(Math.min(tp,0)+1)*100+'%';
                //         }

                //         fixBlock(cpage,tpage,this.pages,this.container);
                //     }
                // }();

                // TRANSITION['flip'+name]=function(cpage,cp,tpage,tp){
                //     var prop=name||['X','Y'][1-this.direction],
                //         fix=prop=='X'?-1:1;
                //     if(perspective){
                //         cpage.style[backfaceVisibility]='hidden';
                //         cpage.style[transform]='perspective(1000px) rotate'+prop+'('+cp*180*fix+'deg)'+fire3D;
                //         if(tpage){
                //             tpage.style[backfaceVisibility]='hidden';
                //             tpage.style[transform]='perspective(1000px) rotate'+prop+'('+tp*180*fix+'deg)'+fire3D;
                //         }
                //     }else TRANSITION['scroll'+name].apply(this,arguments);
                // }

                TRANSITION['flip3d'+name]=function(){
                    var inited;
                    return function(cpage,cp,tpage,tp){
                        var prop=name||['X','Y'][1-this.direction],
                            fe=prop=='X'?-1:1,
                            fix=fe*(cp<0?1:-1),
                            zh=cpage['offset'+(prop=='X'?'Height':'Width')]/2;
                        if(preserve3d){
                            if(!inited){
                                inited=true;
                                cpage.parentNode.parentNode.style[perspective]='1000px';
                                cpage.parentNode.style[transformStyle]='preserve-3d';
                            }
                            cpage.parentNode.style[transform]='translateZ(-'+zh+'px) rotate'+prop+'('+cp*90*fe+'deg)';
                            cpage.style[transform]='rotate'+prop+'(0) translateZ('+zh+'px)';
                            if(tpage){
                                tpage.style[transform]='rotate'+prop+'('+(fix*90)+'deg) translateZ('+zh+'px)';
                            }
                        }else TRANSITION['scroll'+name].apply(this,arguments);
                    }
                }();

                // TRANSITION['flipClock'+name]=function(){
                //     var createWrap=function(node,container,prop,off){
                //             var wrap=node.parentNode,
                //                 len=prop=='X'?'height':'width',
                //                 pos=prop=='X'?'top':'left',
                //                 origin=['50%',(off?0:100)+'%'][prop=='X'?'slice':'reverse']().join(' ');

                //             if(!wrap||wrap==container){
                //                 wrap=DOC.createElement('div');
                //                 wrap.style.cssText='position:absolute;top:0;left:0;height:100%;width:100%;overflow:hidden;display:none;';
                //                 wrap.style[transformOrigin]=origin;
                //                 wrap.style[backfaceVisibility]='hidden';
                //                 wrap.appendChild(node);
                //                 container.appendChild(wrap);
                //             }

                //             wrap.style[len]='50%';
                //             wrap.style[pos]=off*100+'%';
                //             node.style[len]='200%';
                //             node.style[pos]=-off*200+'%';

                //             return wrap;
                //         },
                //         fixBlock=function(cpage,tpage,pages,container){
                //             each(pages,function(page){
                //                 if(page.parentNode==container)return;
                //                 if(cpage!=page && tpage!=page){
                //                     page.parentNode.style.display=page._clone.parentNode.style.display='none';
                //                 }else{
                //                     page.parentNode.style.display=page._clone.parentNode.style.display='block';
                //                 }
                //             });
                //         };

                //     return function(cpage,cp,tpage,tp){
                //         var prop=name||['X','Y'][1-this.direction],
                //             isSelf=this.pages[this.current]==cpage,
                //             zIndex=Number(Math.abs(cp)<.5),
                //             fix=prop=='X'?1:-1,
                //             m,n;
                //         if(perspective){
                //             createWrap(cpage,this.container,prop,0);
                //             createWrap(cpage._clone||(cpage._clone=cpage.cloneNode(true)),this.container,prop,.5);

                //             m=n=-cp*180*fix;
                //             cp>0?n=0:m=0;
                //             cpage.parentNode.style.zIndex=cpage._clone.parentNode.style.zIndex=zIndex;
                //             cpage.parentNode.style[transform]='perspective(1000px) rotate'+prop+'('+m+'deg)';
                //             cpage._clone.parentNode.style[transform]='perspective(1000px) rotate'+prop+'('+n+'deg)';

                //             if(tpage){
                //                 createWrap(tpage,this.container,prop,0);
                //                 createWrap(tpage._clone||(tpage._clone=tpage.cloneNode(true)),this.container,prop,.5);

                //                 m=n=-tp*180*fix;
                //                 cp>0?m=0:n=0;
                //                 tpage.parentNode.style.zIndex=tpage._clone.parentNode.style.zIndex=1-zIndex;
                //                 tpage.parentNode.style[transform]='perspective(1000px) rotate'+prop+'('+m+'deg)';
                //                 tpage._clone.parentNode.style[transform]='perspective(1000px) rotate'+prop+'('+n+'deg)';
                //             }

                //             fixBlock(cpage,tpage,this.pages,this.container);

                //             if(0==cp||tp==0){
                //                 cpage=this.pages[this.current];
                //                 cpage.style.height=cpage.style.width=cpage.parentNode.style.height=cpage.parentNode.style.width='100%';
                //                 cpage.style.top=cpage.style.left=cpage.parentNode.style.top=cpage.parentNode.style.left=0;
                //                 cpage.parentNode.style.zIndex=2;
                //             }
                //         }else TRANSITION['scroll'+name].apply(this,arguments);
                //     }
                // }();

                // TRANSITION['flipPaper'+name]=function(){
                //     var backDiv;

                //     return function(cpage,cp,tpage,tp){
                //         var prop=name||['X','Y'][this.direction],
                //             len=prop=='X'?'width':'height',
                //             m=Math.abs(cp)*100;
                //         if(!backDiv){
                //             backDiv=DOC.createElement('div');
                //             backDiv.style.cssText='position:absolute;z-index:2;top:0;left:0;height:0;width:0;background:no-repeat #fff;';
                //             try{
                //                 backDiv.style.backgroundImage=this.cssVendor+'linear-gradient('+(prop=='X'?'right':'bottom')+', #aaa 0,#fff 20px)';
                //             }catch(e){}
                //             this.container.appendChild(backDiv);
                //         }

                //         TRANSITION['slice'+name].apply(this,arguments);

                //         backDiv.style.display=cp==0||tp==0?'none':'block';
                //         backDiv.style.width=backDiv.style.height='100%';
                //         backDiv.style[len]=(cp<0?m:100-m)+'%';
                //         backDiv.style[XY[prop]]=(cp<0?100-2*m:2*m-100)+'%';
                //     }
                // }();

                TRANSITION['zoom'+name]=function(cpage,cp,tpage,tp){
                    var zIndex=Number(Math.abs(cp)<.5);
                    if(transform){
                        cpage.style[transform]='scale'+name+'('+Math.abs(1-Math.abs(cp)*2)+')'+fire3D;
                        cpage.style.zIndex=zIndex;
                        if(tpage){
                            tpage.style[transform]='scale'+name+'('+Math.abs(1-Math.abs(cp)*2)+')'+fire3D;
                            tpage.style.zIndex=1-zIndex;
                        }
                    }else TRANSITION['scroll'+name].apply(this,arguments);
                }

                TRANSITION['bomb'+name]=function(cpage,cp,tpage,tp){
                    var zIndex=Number(Math.abs(cp)<.5),
                        val=Math.abs(1-Math.abs(cp)*2);
                    if(transform){
                        cpage.style[transform]='scale'+name+'('+(2-val)+')'+fire3D;
                        cpage.style.opacity=zIndex?val:0;
                        cpage.style.zIndex=zIndex;
                        if(tpage){
                            tpage.style[transform]='scale'+name+'('+(2-val)+')'+fire3D;
                            tpage.style.opacity=zIndex?0:val;
                            tpage.style.zIndex=1-zIndex;
                        }
                    }else TRANSITION['scroll'+name].apply(this,arguments);
                }

                TRANSITION['skew'+name]=function(cpage,cp,tpage,tp){
                    var zIndex=Number(Math.abs(cp)<.5);
                    if(transform){
                        cpage.style[transform]='skew'+name+'('+cp*180+'deg)'+fire3D;
                        cpage.style.zIndex=zIndex;
                        if(tpage){
                            tpage.style[transform]='skew'+name+'('+tp*180+'deg)'+fire3D;
                            tpage.style.zIndex=1-zIndex;
                        }
                    }else TRANSITION['scroll'+name].apply(this,arguments);
                }

                $.each(["Reverse", "In", "Out"],function(i, type){
                    TRANSITION['scrollCover'+type+name]=function(cpage,cp,tpage,tp){
                        var prop=name||['X','Y'][this.direction],
                            zIndex=Number(type=='In'||!type&&cp<0||type=='Reverse'&&cp>0),
                            cr=100,tr=100;
                        zIndex?cr=20:tr=20;
                        transform?cpage.style[transform]='translate'+prop+'('+cp*cr+'%)'+fire3D:cpage.style[XY[prop]]=cp*cr+'%';
                        cpage.style.zIndex=1-zIndex;
                        if(tpage){
                            transform?tpage.style[transform]='translate'+prop+'('+tp*tr+'%)'+fire3D:tpage.style[XY[prop]]=tp*tr+'%';
                            tpage.style.zIndex=zIndex;
                        }
                    }

                    TRANSITION['slideCover'+type+name]=function(cpage,cp,tpage,tp){
                        var prop=name||['X','Y'][this.direction],
                            zIndex=Number(type=='In'||!type&&cp<0||type=='Reverse'&&cp>0);
                        if(transform){
                            cpage.style[transform]='translate'+prop+'('+cp*(100-zIndex*100)+'%) scale('+((1-Math.abs(zIndex&&cp))*.2+.8)+')'+fire3D;
                            cpage.style.zIndex=1-zIndex;
                            if(tpage){
                                tpage.style[transform]='translate'+prop+'('+tp*zIndex*100+'%) scale('+((1-Math.abs(zIndex?0:tp))*.2+.8)+')'+fire3D;
                                tpage.style.zIndex=zIndex;
                            }
                        }else TRANSITION['scrollCover'+type+name].apply(this,arguments);
                    }

                    TRANSITION['flowCover'+type+name]=function(cpage,cp,tpage,tp){
                        var prop=name||['X','Y'][this.direction],
                            zIndex=Number(type=='In'||!type&&cp<0||type=='Reverse'&&cp>0);
                        if(transform){
                            cpage.style[transform]='translate'+prop+'('+cp*(100-zIndex*50)+'%) scale('+((1-Math.abs(cp))*.5+.5)+')'+fire3D;
                            cpage.style.zIndex=1-zIndex;
                            if(tpage){
                                tpage.style[transform]='translate'+prop+'('+tp*(50+zIndex*50)+'%) scale('+((1-Math.abs(tp))*.5+.5)+')'+fire3D;
                                tpage.style.zIndex=zIndex;
                            }
                        }else TRANSITION['scrollCover'+type+name].apply(this,arguments);
                    }

                    TRANSITION['flipCover'+type+name]=function(cpage,cp,tpage,tp){
                        var prop=name||['X','Y'][1-this.direction],
                            zIndex=Number(type=='In'||!type&&cp<0||type=='Reverse'&&cp>0);
                        if(perspective){
                            zIndex?cp=0:tp=0;
                            cpage.style[transform]='perspective(1000px) rotate'+prop+'('+cp*-90+'deg)'+fire3D;
                            cpage.style.zIndex=1-zIndex;
                            if(tpage){
                                tpage.style[transform]='perspective(1000px) rotate'+prop+'('+tp*-90+'deg)'+fire3D;
                                tpage.style.zIndex=zIndex;
                            }
                        }else TRANSITION['scroll'+name].apply(this,arguments);
                    }

                    TRANSITION['skewCover'+type+name]=function(cpage,cp,tpage,tp){
                        var zIndex=Number(type=='In'||!type&&cp<0||type=='Reverse'&&cp>0);
                        if(transform){
                            zIndex?cp=0:tp=0;
                            cpage.style[transform]='skew'+name+'('+cp*90+'deg)'+fire3D;
                            cpage.style.zIndex=1-zIndex;
                            if(tpage){
                                tpage.style[transform]='skew'+name+'('+tp*90+'deg)'+fire3D;
                                tpage.style.zIndex=zIndex;
                            }
                        }else TRANSITION['scroll'+name].apply(this,arguments);
                    }

                    TRANSITION['zoomCover'+type+name]=function(cpage,cp,tpage,tp){
                        var zIndex=Number(type=='In'||!type&&cp<0||type=='Reverse'&&cp>0);
                        if(transform){
                            zIndex?cp=0:tp=0;
                            cpage.style[transform]='scale'+name+'('+(1-Math.abs(cp))+')'+fire3D;
                            cpage.style.zIndex=1-zIndex;
                            if(tpage){
                                tpage.style[transform]='scale'+name+'('+(1-Math.abs(tp))+')'+fire3D;
                                tpage.style.zIndex=zIndex;
                            }
                        }else TRANSITION['scroll'+name].apply(this,arguments);
                    }

                    TRANSITION['bombCover'+type+name]=function(cpage,cp,tpage,tp){
                        var zIndex=Number(type=='In'||!type&&cp<0||type=='Reverse'&&cp>0);
                        if(transform){
                            zIndex?cp=0:tp=0;
                            cpage.style[transform]='scale'+name+'('+(1+Math.abs(cp))+')'+fire3D;
                            cpage.style.zIndex=1-zIndex;
                            if(tpage){
                                tpage.style[transform]='scale'+name+'('+(1+Math.abs(tp))+')'+fire3D;
                                tpage.style.zIndex=zIndex;
                            }
                            TRANSITION.fade.apply(this,arguments);
                        }else TRANSITION['scroll'+name].apply(this,arguments);
                    }
                });
            });
        },
        init:function(config){
            // 初始化事件
            this._EVENT();
            this.initTRANSITION();
            // 处理传入的函数值
            var that=this,
                handler=this.handler=function(ev){// why 执行两次 maybe 事件触发两次
                    !that.frozen && that.handleEvent(ev);
                }

            this.events={};
            this.start=config.start;
            // {
                // this.duration=isNaN(parseInt(config.duration))?600:parseInt(config.duration);
                // this.direction=parseInt(config.direction)==0?0:1;
                // this.loop=!!config.loop;
                // this.mouse=config.mouse==null?true:!!config.mouse;
                // this.mousewheel=!!config.mousewheel;
                // this.interval=parseInt(config.interval)||5000;
                // this.playing=!!config.autoplay; playing mark
                // this.arrowkey=!!config.arrowkey;
                // this.frozen=!!config.freeze;
                // this.pages=children(this.$container);
            // }
            this.$container = $(config.container);
            this.pages = this.$container.children('.page');
            this.length=this.pages.length;

            this.pageData=[];

            $(this.$container).on(this._STARTEVENT.join(' ') + ' click' + (config.mousewheel ? ' mousewheel DOMMouseScroll' : ''), handler);
            $(document).on(this._MOVEEVENT.join(' ') + (this.arrowkey ? ' keydown' : ''), handler);

            $.each(this.pages, function(index, page){
                that.pageData.push({
                    percent:0,
                    cssText:page.style.cssText||''
                });
                $(page).css(that._defaultStyle);
            });
            this.pages.eq(this.start).css({display: 'block'});

            // 绑定事件 哪里用还不知道 todo
            // $.each({
            //     before:function(){clearTimeout(this.playTimer);},
            //     dragStart:function(){clearTimeout(this.playTimer);removeRange();},
            //     after:this.firePlay,
            //     update:null
            // }, function (ev, callback) {
            //     that.on(ev,callback);
            //     // that.events 里去了 todo
            // });
            // 不知道干啥的 todo
            this.on({
                before:function(){clearTimeout(this.playTimer);},
                dragStart:function(){clearTimeout(this.playTimer);removeRange();},
                after:this.firePlay,
                update:null
            }).firePlay();

            this.setEase(config.ease);
            this._setTransition(config.transition);
        },
        setEase:function(ease){
            this.ease=typeof ease === 'function' ? ease : this._EASE[ease];
            return this;// todo why?
        },
        addEase:function(name,func){
            isFunction(func) && (EASE[name]=func);
            return this;
        },
        _setTransition:function(transition){
            this.events.update.splice(0,1,typeof transition === 'function' ? transition : TRANSITION[transition]);
            return this;
        },
        addTransition:function(name,func){
            isFunction(func) && (TRANSITION[name]=func);
            return this;
        },
        _colorRand: function () {
            return parseInt(Math.random()*255);
        },
        createPage: function (){
            // var div=document.createElement('div');
            // div.style.backgroundColor='rgb('+colorRand()+','+colorRand()+','+colorRand()+')';
            return $('<div />').css({
                'background-color': 'rgb('+this._colorRand()+','+this._colorRand()+','+this._colorRand()+')'
            });
        },
        isStatic:function(){
            return !this.timer && !this.drag;
        },
        on: function(ev,callback){
            var that=this;
            if(typeof ev === 'object'){
                $.each(ev,function(ev,callback){
                    that.on(ev,callback);
                });
            }else{
                if(!this.events[ev]){
                    this.events[ev]=[];
                }
                this.events[ev].push(callback);
            }
            return this;
        },
        fire:function(ev){
            var that=this,
                args=slice.call(arguments,1);
            each(this.events[ev]||[],function(func){
                if(isFunction(func)){
                    func.apply(that,args);
                }
            });
            return this;
        },
        freeze:function(able){
            this.frozen=able==null?true:!!able;
            return this;
        },
        slide:function(index){
            var that=this,
                dir=this.direction,
                duration=this.duration,
                stime=+new Date,
                ease=this.ease,
                current=this.start,
                fixIndex=Math.min(this.length-1,Math.max(0,this.fixIndex(index))),
                cpage=this.pages[current],
                percent=this.getPercent(),
                tIndex=this.fixIndex(fixIndex==current?current+(percent>0?-1:1):fixIndex),
                tpage=this.pages[tIndex],
                target=index>current?-1:1,
                _tpage=cpage;

            cancelFrame(this.timer);

            if(fixIndex==current){
                target=0;
                _tpage=tpage;
            }else if(tpage.style.display=='none'){
                percent=0;
            }

            this.fixBlock(current,tIndex);
            this.fire('before',current,fixIndex);
            this.start=fixIndex;

            duration*=Math.abs(target-percent);

            this.latestTime=stime+duration;

            ani();

            function ani(){
                var offset=Math.min(duration,+new Date-stime),
                    s=duration?ease(offset,0,1,duration):1,
                    cp=(target-percent)*s+percent;
                that.fixUpdate(cp,current,tIndex);
                if(offset==duration){
                    if(_tpage){
                        _tpage.style.display='none';
                    }
                    delete that.timer;
                    that.fire('after',fixIndex,current);
                }else{
                    that.timer=nextFrame(ani);
                }
            }

            return this;
        },
        prev:function(){
            return this.slide(this.start-1);
        },
        next:function(){
            return this.slide(this.start+1);
        },
        play:function(){
            this.playing=true;
            return this.firePlay();
        },
        firePlay:function(){
            var that=this;
            if(this.playing){
                this.playTimer=setTimeout(function(){
                    that.slide((that.current+1)%(that.loop?Infinity:that.length));
                },this.interval);
            }
            return this;
        },
        pause:function(){
            this.playing=false;
            clearTimeout(this.playTimer);
            return this;
        },
        fixIndex:function(index){
            return this.length>1&&this.loop?(this.length+index)%this.length:index;
        },
        fixBlock:function(cIndex,tIndex){
            each(this.pages,function(page,index){
                if(cIndex!=index && tIndex!=index){
                    page.style.display='none';
                }else{
                    page.style.display='block';
                }
            });
            return this;
        },
        fixUpdate:function(cPer,cIndex,tIndex){
            var pageData=this.pageData,
                cpage=this.pages[cIndex],
                tpage=this.pages[tIndex],
                tPer;
            pageData[cIndex].percent=cPer;
            if(tpage){
                tPer=pageData[tIndex].percent=cPer>0?cPer-1:1+cPer;
            }
            return this.fire('update',cpage,cPer,tpage,tPer);
        },
        getPercent:function(index){
            var pdata=this.pageData[index==null?this.start:index];
            return pdata&&(pdata.percent||0);
        },
        getOffsetParent:function(){
            var position=$(this.$container).attr('position');
            if(position&&position!='static'){
                return this.$container;
            }
            return this.$container.offsetParent||DOC.body;
        },
        handleEvent:function(oldEvent){
            var that = this,
                ev= this._filterEvent(oldEvent),
                canDrag=ev.button<1&&ev.length<2&&(!this.pointerType||this.pointerType==ev.eventType)&&(this.mouse||ev.pointerType!='mouse');

            switch(ev.eventCode){
                case 2:
                    if(canDrag&&this.rect){
                        var cIndex=this.start,
                            dir=this.direction,
                            rect=[ev.clientX,ev.clientY],
                            _rect=this.rect,
                            offset=rect[dir]-_rect[dir],
                            cpage=this.pages[cIndex],
                            total=this.offsetParent[dir?'clientHeight':'clientWidth'],
                            tIndex,percent;
                        if(this.drag==null && _rect.toString()!=rect.toString()){
                            this.drag=Math.abs(offset)>=Math.abs(rect[1-dir]-_rect[1-dir]);
                            this.drag && this.fire('dragStart',ev);
                        }
                        if(this.drag){
                            percent=this.percent+(total&&offset/total);
                            if(!this.pages[tIndex=this.fixIndex(cIndex+(percent>0?-1:1))]){
                                percent/=Math.abs(offset)/total+2;
                            }
                            this.fixBlock(cIndex,tIndex);
                            this.fire('dragMove',ev);
                            this.fixUpdate(percent,cIndex,tIndex);
                            this._offset=offset;
                            ev.preventDefault();
                        }
                    }
                    break;

                case 1:
                case 3:
                    if(canDrag){
                        var that=this,
                            index=this.start,
                            percent=this.getPercent(),
                            isDrag,offset,tm,nn;
                        if(ev.length&&(ev.eventCode==1||this.drag)){
                            nn=ev.target.nodeName.toLowerCase();
                            clearTimeout(this.eventTimer);
                            if(!this.pointerType){
                                this.pointerType=ev.eventType;
                            }
                            if(this.timer){
                                cancelFrame(this.timer);
                                delete this.timer;
                            }
                            this.rect=[ev.clientX,ev.clientY];
                            this.percent=percent;
                            this.time=+new Date;
                            this.offsetParent=this.getOffsetParent();
                            if(ev.eventType!='touch' && (nn=='a' || nn=='img')){
                                ev.preventDefault();
                            }
                        }else if(tm=this.time){
                            offset=this._offset;
                            isDrag=this.drag;

                            $.each(['rect', 'drag', 'time', 'percent', '_offset', 'offsetParent'],function(prop){
                                delete that[prop];
                            });

                            if(isDrag){
                                if(+new Date-tm<500&&Math.abs(offset)>20 || Math.abs(percent)>.5){
                                    index+=offset>0?-1:1;
                                }
                                this.fire('dragEnd',ev);
                                ev.preventDefault();
                            }

                            if(percent){
                                this.slide(index);
                            }else if(isDrag){
                                this.firePlay();
                            }

                            this.eventTimer=setTimeout(function(){
                                delete that.pointerType;
                            },400);
                        }
                    }
                    break;

                case 4:
                    if(this.timer){
                        ev.preventDefault();
                    }
                    break;

                case 5:
                    ev.preventDefault();
                    if(this.isStatic() && +new Date-this.latestTime>Math.max(1000-this.duration,0)){
                        var wd=ev.wheelDelta||-ev.detail;
                        Math.abs(wd)>=3 && this[wd>0?'prev':'next']();
                    }
                    break;

                case 6:
                    var nn=ev.target.nodeName.toLowerCase();
                    if(this.isStatic() && nn!='input' && nn!='textarea' && nn!='select'){
                        switch(ev.keyCode||ev.which){
                            case 33:
                            case 37:
                            case 38:
                                this.prev();
                                break;
                            case 32:
                            case 34:
                            case 39:
                            case 40:
                                this.next();
                                break;
                            case 35:
                                this.slide(this.length-1);
                                break;
                            case 36:
                                this.slide(0);
                                break;
                        }
                    }
                    break;
            }
        },
        destroy:function(){
            var pageData=this.pageData;

            offListener(this.$container,STARTEVENT.join(" ")+" click"+(this.mousewheel?" mousewheel DOMMouseScroll":""),this.handler);
            offListener(DOC,MOVEEVENT.join(" ")+(this.arrowkey?" keydown":""),this.handler);

            each(this.pages,function(page,index){
                page.style.cssText=pageData[index].cssText;
            });

            this.$container.removeChild(this.comment);

            this.length=0;

            return this.pause();
        },
        append:function(el,index){
            if(null == index){// 防止index == 0
                index=this.pages.length;
            }
            this.pageData.splice(index,0,{
                percent:0,
                cssText:el.style.cssText
            });
            this.pages.splice(index,0,el);
            this.$container.appendChild(this.initStyle(el));

            this.length=this.pages.length;

            if(index<=this.start){
                this.start++;
            }

            return this;
        },
        prepend:function(el){
            return this.append(el,0);
        },
        insertBefore:function(el,index){
            return this.append(el,index-1);
        },
        insertAfter:function(el,index){
            return this.append(el,index+1);
        },
        remove:function(index){
            this.$container.removeChild(this.pages[index]);
            this.pages.splice(index,1);
            this.pageData.splice(index,1);

            this.length=this.pages.length;

            if(index<=this.start){
                this.slide(this.start=Math.max(0,this.start-1));
            }

            return this;
        }
    };

    // 挂载
    ns.PageSwitch = PageSwitch;
})(Zepto, window);

// 使用
var a = new PageSwitch({
    container: '#pages',
    duration:1000,
    direction:1,
    loop:true,
    ease:'ease',// 还可以传入函数 todo
    transition: 'flip3d',
    freeze:false,
});