/*
 * pageSwitch
 * @author qiqiboy
 * @github https://github.com/qiqiboy/pageSwitch
 */
;
(function($, ROOT, undefined){
    "use strict";
    // 全局变量
    var VERSION='2.3.2';
    var lastTime=0,
        nextFrame=ROOT.requestAnimationFrame            ||
                ROOT.webkitRequestAnimationFrame        ||
                ROOT.mozRequestAnimationFrame           ||
                ROOT.msRequestAnimationFrame            ||
                function(callback){
                    var currTime=+new Date,
                        delay=Math.max(1000/60,1000/60-(currTime-lastTime));
                    lastTime=currTime+delay;
                    return setTimeout(callback,delay);
                },
        cancelFrame=ROOT.cancelAnimationFrame           ||
                ROOT.webkitCancelAnimationFrame         ||
                ROOT.webkitCancelRequestAnimationFrame  ||
                ROOT.mozCancelRequestAnimationFrame     ||
                ROOT.msCancelRequestAnimationFrame      ||
                clearTimeout,
        DOC=ROOT.document,
        divstyle=DOC.createElement('div').style,
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
        opacity=cssTest('opacity'),
        transform=cssTest('transform'),
        perspective=cssTest('perspective'),
        transformStyle=cssTest('transform-style'),
        transformOrigin=cssTest('transform-origin'),
        backfaceVisibility=cssTest('backface-visibility'),
        preserve3d=transformStyle&&function(){
            divstyle[transformStyle]='preserve-3d';
            return divstyle[transformStyle]=='preserve-3d';
        }(),
        toString=Object.prototype.toString,
        slice=[].slice,
        event2type={},
        event2code={
            click:4,
            mousewheel:5,
            dommousescroll:5,
            keydown:6
        },
        POINTERTYPES={
            2:'touch',
            3:'pen',
            4:'mouse',
            pen:'pen'
        },
        STARTEVENT=[],
        MOVEEVENT=[],
        EVENT=function(){
            var ret={},
                states={
                    start:1,
                    down:1,
                    move:2,
                    end:3,
                    up:3,
                    cancel:3
                };
            $.each("mouse touch pointer MSPointer-".split(" "),function(i, prefix){
                var _prefix=/pointer/i.test(prefix)?'pointer':prefix;
                ret[_prefix]=ret[_prefix]||{};
                POINTERTYPES[_prefix]=_prefix;
                $.each(states,function(endfix,code){
                    var ev=camelCase(prefix+endfix);
                    ret[_prefix][ev]=code;
                    event2type[ev.toLowerCase()]=_prefix;
                    event2code[ev.toLowerCase()]=code;
                    if(code==1){
                        STARTEVENT.push(ev);
                    }else{
                        MOVEEVENT.push(ev);
                    }
                });
            });
            return ret;
        }(),
        POINTERS={
            touch:{},
            pointer:{},
            mouse:{}
        },
        EASE={
            ease: function(t, b, c, d) { console.log(t, b, c, d);
                return -c * ((t = t / d - 1) * t * t * t - 1) + b;
            }
        },
        TRANSITION={
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

    function camelCase(str){
        return (str+'').replace(/^-ms-/, 'ms-').replace(/-([a-z]|[0-9])/ig, function(all, letter){
            return (letter+'').toUpperCase();
        });
    }

    function cssTest(name){
        var prop=camelCase(name),
            _prop=camelCase(cssVendor+prop);
        return (prop in divstyle) && prop || (_prop in divstyle) && _prop || '';
    }

    function pointerLength(obj){
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
    }

    function pointerItem(obj,n){
        return 'item' in obj?obj.item(n):function(){
            var i=0,key;
            for(key in this){
                if(i++==n){
                    return this[key];
                }
            }
        }.call(obj,n);
    }

    function removeRange(){
        var range;
        if(ROOT.getSelection){
            range=getSelection();
            if('empty' in range)range.empty();
            else if('removeAllRanges' in range)range.removeAllRanges();
        }else{
            DOC.selection.empty();
        }
    }

    function filterEvent(oldEvent){
        var ev={},
            which=oldEvent.which,
            button=oldEvent.button,
            pointers,pointer;

        $.each("wheelDelta detail which keyCode".split(" "),function(i, prop){
            ev[prop]=oldEvent[prop];
        });

        ev.oldEvent=oldEvent;

        ev.type=oldEvent.type.toLowerCase();
        ev.eventType=event2type[ev.type]||ev.type;
        ev.eventCode=event2code[ev.type]||0;
        ev.pointerType=POINTERTYPES[oldEvent.pointerType]||oldEvent.pointerType||ev.eventType;

        ev.target=oldEvent.target||oldEvent.srcElement||DOC.documentElement;
        if(ev.target.nodeType===3){
            ev.target=ev.target.parentNode;
        }

        ev.preventDefault=function(){
            oldEvent.preventDefault && oldEvent.preventDefault();
            ev.returnValue=oldEvent.returnValue=false;
        }

        if(pointers=POINTERS[ev.eventType]){
            switch(ev.eventType){
                case 'mouse':
                case 'pointer':
                    var id=oldEvent.pointerId||0;
                    ev.eventCode==3?delete pointers[id]:pointers[id]=oldEvent;
                    break;
                case 'touch':
                    POINTERS[ev.eventType]=pointers=oldEvent.touches;
                    break;
            }

            if(pointer=pointerItem(pointers,0)){
                ev.clientX=pointer.clientX;
                ev.clientY=pointer.clientY;
            }

            ev.button=which<4?Math.max(0,which-1):button&4&&1||button&2; // left:0 middle:1 right:2
            ev.length=pointerLength(pointers);
        }

        return ev;
    }

    // 构造函数
    function struct(config) {
        this.init($.extend({
            // default
            duration:1000,
            start:0,
            direction:1,
            loop:true,
            ease:'ease',
            transition: 'flip',
            freeze:false,
            mouse:true,
            mousewheel:true,
            arrowkey:true
        }, config));
    }
    // 原型方法
    struct.prototype={
        version:VERSION,
        constructor:struct,
        latestTime:0,
        init:function(config){
            var self=this,
                handler=this.handler=function(ev){
                    !self.frozen && self.handleEvent(ev);
                }

            this.events={};
            this.container = $(config.container)[0];
            this.duration=isNaN(parseInt(config.duration))?600:parseInt(config.duration);
            this.direction=parseInt(config.direction)==0?0:1;
            this.current=parseInt(config.start)||0;
            this.loop=!!config.loop;
            this.mouse=config.mouse==null?true:!!config.mouse;
            this.mousewheel=!!config.mousewheel;
            this.interval=parseInt(config.interval)||5000;
            this.playing=!!config.autoplay;
            this.arrowkey=!!config.arrowkey;
            this.frozen=!!config.freeze;
            this.pages=$(this.container).children('div');
            this.length=this.pages.length;

            this.pageData=[];

            $(this.container).on(STARTEVENT.join(" ")+" click"+(this.mousewheel?" mousewheel DOMMouseScroll":""),handler);
            $(window).on(MOVEEVENT.join(" ")+(this.arrowkey?" keydown":""),handler);

            $.each(this.pages,function(i, page){
                self.pageData.push({
                    percent:0,
                    cssText:page.style.cssText||''
                });
                self.initStyle(page);
            });
            this.pages[this.current].style.display='block';

            var progressEvents = {
                before:function(){clearTimeout(this.playTimer);},
                dragStart:function(){clearTimeout(this.playTimer);removeRange();},
                after:this.firePlay,
                update:null
            };
            $.each(progressEvents, function(ev, callback) {
                if(!self.events[ev]){
                    self.events[ev]=[];
                }
                self.events[ev].push(callback);
            })
            $(this.container).on(progressEvents);
            this.firePlay();

            this.setEase(config.ease);
            this.setTransition(config.transition);
        },
        initStyle:function(elem){
            var style=elem.style,
                ret;
            $.each("position:absolute;top:0;left:0;width:100%;height:100%;display:none".split(";"),function(i, css){
                ret=css.split(":");
                style[ret[0]]=ret[1];
            });
            return elem;
        },
        setEase:function(ease){
            this.ease=$.isFunction(ease)?ease:EASE[ease]||EASE.ease;
            return this;
        },
        addEase:function(name,func){
            $.isFunction(func) && (EASE[name]=func);
            return this;
        },
        setTransition:function(transition){
            this.events.update.splice(0,1,$.isFunction(transition)?transition:TRANSITION[transition]||TRANSITION.slide);
            return this;
        },
        addTransition:function(name,func){
            $.isFunction(func) && (TRANSITION[name]=func);
            return this;
        },
        isStatic:function(){
            return !this.timer && !this.drag;
        },
        fire:function(ev){
            var self=this,
                args=slice.call(arguments,1);
            $.each(this.events[ev]||[],function(i, func){
                if($.isFunction(func)){
                    func.apply(self,args);
                }
            });
            return this;
        },
        freeze:function(able){
            this.frozen=able==null?true:!!able;
            return this;
        },
        slide:function(index){
            var self=this,
                dir=this.direction,
                duration=this.duration,
                stime=+new Date,
                ease=this.ease,
                current=this.current,
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
            this.current=fixIndex;

            duration*=Math.abs(target-percent);

            this.latestTime=stime+duration;

            ani();

            function ani(){
                var offset=Math.min(duration,+new Date-stime),
                    s=duration?ease(offset,0,1,duration):1,
                    cp=(target-percent)*s+percent;
                self.fixUpdate(cp,current,tIndex);
                if(offset==duration){
                    if(_tpage){
                        _tpage.style.display='none';
                    }
                    delete self.timer;
                    self.fire('after',fixIndex,current);
                }else{
                    self.timer=nextFrame(ani);
                }
            }

            return this;
        },
        prev:function(){
            return this.slide(this.current-1);
        },
        next:function(){
            return this.slide(this.current+1);
        },
        play:function(){
            this.playing=true;
            return this.firePlay();
        },
        firePlay:function(){
            var self=this;
            if(this.playing){
                this.playTimer=setTimeout(function(){
                    self.slide((self.current+1)%(self.loop?Infinity:self.length));
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
            $.each(this.pages,function(index, page){
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
            var pdata=this.pageData[index==null?this.current:index];
            return pdata&&(pdata.percent||0);
        },
        getOffsetParent:function(){
            // var position=getStyle(this.container,'position');
            var position=$(this.container).css('position');
            if(position&&position!='static'){
                return this.container;
            }
            return this.container.offsetParent||DOC.body;
        },
        handleEvent:function(oldEvent){
            var ev=filterEvent(oldEvent),
                canDrag=ev.button<1&&ev.length<2&&(!this.pointerType||this.pointerType==ev.eventType)&&(this.mouse||ev.pointerType!='mouse');

            switch(ev.eventCode){
                case 2:
                    if(canDrag&&this.rect){
                        var cIndex=this.current,
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
                        var self=this,
                            index=this.current,
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

                            $.each("rect drag time percent _offset offsetParent".split(" "),function(i, prop){
                                delete self[prop];
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
                                delete self.pointerType;
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


            $(this.container).off(STARTEVENT.join(" ")+" click"+(this.mousewheel?" mousewheel DOMMouseScroll":""),this.handler);
            $(DOC).off(MOVEEVENT.join(" ")+(this.arrowkey?" keydown":""),this.handler);

            $.each(this.pages,function(index, page){
                page.style.cssText=pageData[index].cssText;
            });

            this.container.removeChild(this.comment);

            this.length=0;

            return this.pause();
        },
        append:function(elem,index){
            if(null==index){
                index=this.pages.length;
            }
            this.pageData.splice(index,0,{
                percent:0,
                cssText:elem.style.cssText
            });
            this.pages.splice(index,0,elem);
            this.container.appendChild(this.initStyle(elem));

            this.length=this.pages.length;

            if(index<=this.current){
                this.current++;
            }

            return this;
        },
        prepend:function(elem){
            return this.append(elem,0);
        },
        insertBefore:function(elem,index){
            return this.append(elem,index-1);
        },
        insertAfter:function(elem,index){
            return this.append(elem,index+1);
        },
        remove:function(index){
            this.container.removeChild(this.pages[index]);
            this.pages.splice(index,1);
            this.pageData.splice(index,1);

            this.length=this.pages.length;

            if(index<=this.current){
                this.slide(this.current=Math.max(0,this.current-1));
            }

            return this;
        }
    }
    // todo why 可能是暴露给外部的方法  方便设置transition 和 ease
    $.each("Ease Transition".split(" "),function(i, name){
        struct['add'+name]=struct.prototype['add'+name];
    });

    ROOT.pageSwitch=struct;
})(Zepto, window);
