;(function () {
    'use strict';

    var divstyle=document.createElement('div').style,
        camelCase = function (str){
            return (str+'').replace(/^-ms-/, 'ms-').replace(/-([a-z]|[0-9])/ig, function(all, letter){
                return (letter+'').toUpperCase();
            });
        },
        cssTest = function (name){
            var prop=camelCase(name),
                _prop=camelCase(cssVendor+prop);
            return (prop in divstyle) && prop || (_prop in divstyle) && _prop || '';
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
        opacity=cssTest('opacity'),
        transform=cssTest('transform'),
        perspective=cssTest('perspective'),
        transformStyle=cssTest('transform-style'),
        transformOrigin=cssTest('transform-origin'),
        backfaceVisibility=cssTest('backface-visibility'),
        preserve3d=transformStyle&&function(){
            divstyle[transformStyle]='preserve-3d';
            return divstyle[transformStyle]=='preserve-3d';
        }();

    window.transitionLib = {};

    $.each("X Y ".split(" "),function(i, name){
        var XY={X:'left',Y:'top'},
            fire3D=perspective?' translateZ(0)':'';

        /* 更改切换效果
         * @param Element cpage 当前页面
         * @param Float cp      当前页面过度百分比
         * @param Element tpage 前序页面
         * @param Float tp      前序页面过度百分比
         */
        transitionLib['fade'+name] = function(cpage,cp,tpage,tp){
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
        transitionLib['scroll'+name]=function(cpage,cp,tpage,tp){
            var prop=name||['X','Y'][this.direction];
            transform?cpage.style[transform]='translate'+prop+'('+cp*100+'%)'+fire3D:cpage.style[XY[prop]]=cp*100+'%';
            if(tpage){
                transform?tpage.style[transform]='translate'+prop+'('+tp*100+'%)'+fire3D:tpage.style[XY[prop]]=tp*100+'%';
            }
        }

        transitionLib['scroll3d'+name]=function(cpage,cp,tpage,tp){
            var prop=name||['X','Y'][this.direction],
                fix=cp<0?-1:1,
                abscp=Math.abs(cp),
                deg;
            if(perspective){
                if(abscp<.05){
                    deg=abscp*1200;
                    cp=0;tp=fix*-1;
                }else if(abscp<.95){
                    deg=60;
                    cp=(cp-.05*fix)/.9;
                    tp=(tp+.05*fix)/.9;
                }else{
                    deg=(1-abscp)*1200;
                    cp=fix;tp=0;
                }
                cpage.parentNode.style[transform]='perspective(1000px) rotateX('+deg+'deg)';
                cpage.style[transform]='translate'+prop+'('+cp*100+'%)';
                if(tpage){
                    tpage.style[transform]='translate'+prop+'('+tp*100+'%)';
                }
            }else transitionLib['scroll'+name].apply(this,arguments);
        }

        transitionLib['slide'+name]=function(cpage,cp,tpage,tp){
            transitionLib['slideCoverReverse'+name].apply(this,arguments);
        }

        transitionLib['flow'+name]=function(cpage,cp,tpage,tp){
            transitionLib['flowCoverIn'+name].apply(this,arguments);
        }

        transitionLib['slice'+name]=function(){
            var createWrap=function(node,container){
                    var wrap=DOC.createElement('div');
                    wrap.style.cssText='position:absolute;top:0;left:0;height:100%;width:100%;overflow:hidden;';
                    wrap.appendChild(node);
                    container.appendChild(wrap);
                },
                fixBlock=function(cpage,tpage,pages,container){
                    $.each(pages,function(i, page){
                        if(page.parentNode==container)return;
                        if(cpage!=page && tpage!=page){
                            page.parentNode.style.display='none';
                        }else{
                            page.parentNode.style.display='block';
                        }
                    });
                };

            return function(cpage,cp,tpage,tp){
                var prop=name||['X','Y'][this.direction],
                    len=prop=='X'?'width':'height',
                    total=this.container[camelCase('client-'+len)],
                    m=Math.abs(cp)*100,
                    n=Math.abs(tp)*100,
                    end=cp==0||tp==0;

                cpage.style[len]=end?'100%':total+'px';
                if(cpage.parentNode==this.container){
                    createWrap(cpage,this.container);
                }
                cpage.parentNode.style.zIndex=cp>0?0:1;
                cpage.parentNode.style[len]=(Math.min(cp,0)+1)*100+'%';

                if(tpage){
                    tpage.style[len]=end?'100%':total+'px';
                    if(tpage.parentNode==this.container){
                        createWrap(tpage,this.container);
                    }
                    tpage.parentNode.style.zIndex=cp>0?1:0;
                    tpage.parentNode.style[len]=(Math.min(tp,0)+1)*100+'%';
                }

                fixBlock(cpage,tpage,this.pages,this.container);
            }
        }();

        transitionLib['flip'+name]=function(cpage,cp,tpage,tp){
            var prop=name||['X','Y'][1-this.direction],
                fix=prop=='X'?-1:1;
            if(perspective){
                cpage.style[backfaceVisibility]='hidden';
                cpage.style[transform]='perspective(1000px) rotate'+prop+'('+cp*180*fix+'deg)'+fire3D;
                if(tpage){
                    tpage.style[backfaceVisibility]='hidden';
                    tpage.style[transform]='perspective(1000px) rotate'+prop+'('+tp*180*fix+'deg)'+fire3D;
                }
            }else transitionLib['scroll'+name].apply(this,arguments);
        }

        transitionLib['flip3d'+name]=function(){
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
                }else transitionLib['scroll'+name].apply(this,arguments);
            }
        }();

        transitionLib['flipClock'+name]=function(){
            var createWrap=function(node,container,prop,off){
                    var wrap=node.parentNode,
                        len=prop=='X'?'height':'width',
                        pos=prop=='X'?'top':'left',
                        origin=['50%',(off?0:100)+'%'][prop=='X'?'slice':'reverse']().join(' ');

                    if(!wrap||wrap==container){
                        wrap=DOC.createElement('div');
                        wrap.style.cssText='position:absolute;top:0;left:0;height:100%;width:100%;overflow:hidden;display:none;';
                        wrap.style[transformOrigin]=origin;
                        wrap.style[backfaceVisibility]='hidden';
                        wrap.appendChild(node);
                        container.appendChild(wrap);
                    }

                    wrap.style[len]='50%';
                    wrap.style[pos]=off*100+'%';
                    node.style[len]='200%';
                    node.style[pos]=-off*200+'%';

                    return wrap;
                },
                fixBlock=function(cpage,tpage,pages,container){
                    $.each(pages,function(i, page){
                        if(page.parentNode==container)return;
                        if(cpage!=page && tpage!=page){
                            page.parentNode.style.display=page._clone.parentNode.style.display='none';
                        }else{
                            page.parentNode.style.display=page._clone.parentNode.style.display='block';
                        }
                    });
                };

            return function(cpage,cp,tpage,tp){
                var prop=name||['X','Y'][1-this.direction],
                    isSelf=this.pages[this.current]==cpage,
                    zIndex=Number(Math.abs(cp)<.5),
                    fix=prop=='X'?1:-1,
                    m,n;
                if(perspective){
                    createWrap(cpage,this.container,prop,0);
                    createWrap(cpage._clone||(cpage._clone=cpage.cloneNode(true)),this.container,prop,.5);

                    m=n=-cp*180*fix;
                    cp>0?n=0:m=0;
                    cpage.parentNode.style.zIndex=cpage._clone.parentNode.style.zIndex=zIndex;
                    cpage.parentNode.style[transform]='perspective(1000px) rotate'+prop+'('+m+'deg)';
                    cpage._clone.parentNode.style[transform]='perspective(1000px) rotate'+prop+'('+n+'deg)';

                    if(tpage){
                        createWrap(tpage,this.container,prop,0);
                        createWrap(tpage._clone||(tpage._clone=tpage.cloneNode(true)),this.container,prop,.5);

                        m=n=-tp*180*fix;
                        cp>0?m=0:n=0;
                        tpage.parentNode.style.zIndex=tpage._clone.parentNode.style.zIndex=1-zIndex;
                        tpage.parentNode.style[transform]='perspective(1000px) rotate'+prop+'('+m+'deg)';
                        tpage._clone.parentNode.style[transform]='perspective(1000px) rotate'+prop+'('+n+'deg)';
                    }

                    fixBlock(cpage,tpage,this.pages,this.container);

                    if(0==cp||tp==0){
                        cpage=this.pages[this.current];
                        cpage.style.height=cpage.style.width=cpage.parentNode.style.height=cpage.parentNode.style.width='100%';
                        cpage.style.top=cpage.style.left=cpage.parentNode.style.top=cpage.parentNode.style.left=0;
                        cpage.parentNode.style.zIndex=2;
                    }
                }else transitionLib['scroll'+name].apply(this,arguments);
            }
        }();

        transitionLib['flipPaper'+name]=function(){
            var backDiv;

            return function(cpage,cp,tpage,tp){
                var prop=name||['X','Y'][this.direction],
                    len=prop=='X'?'width':'height',
                    m=Math.abs(cp)*100;
                if(!backDiv){
                    backDiv=DOC.createElement('div');
                    backDiv.style.cssText='position:absolute;z-index:2;top:0;left:0;height:0;width:0;background:no-repeat #fff;';
                    try{
                        backDiv.style.backgroundImage=cssVendor+'linear-gradient('+(prop=='X'?'right':'bottom')+', #aaa 0,#fff 20px)';
                    }catch(e){}
                    this.container.appendChild(backDiv);
                }

                transitionLib['slice'+name].apply(this,arguments);

                backDiv.style.display=cp==0||tp==0?'none':'block';
                backDiv.style.width=backDiv.style.height='100%';
                backDiv.style[len]=(cp<0?m:100-m)+'%';
                backDiv.style[XY[prop]]=(cp<0?100-2*m:2*m-100)+'%';
            }
        }();

        transitionLib['zoom'+name]=function(cpage,cp,tpage,tp){
            var zIndex=Number(Math.abs(cp)<.5);
            if(transform){
                cpage.style[transform]='scale'+name+'('+Math.abs(1-Math.abs(cp)*2)+')'+fire3D;
                cpage.style.zIndex=zIndex;
                if(tpage){
                    tpage.style[transform]='scale'+name+'('+Math.abs(1-Math.abs(cp)*2)+')'+fire3D;
                    tpage.style.zIndex=1-zIndex;
                }
            }else transitionLib['scroll'+name].apply(this,arguments);
        }

        transitionLib['bomb'+name]=function(cpage,cp,tpage,tp){
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
            }else transitionLib['scroll'+name].apply(this,arguments);
        }

        transitionLib['skew'+name]=function(cpage,cp,tpage,tp){
            var zIndex=Number(Math.abs(cp)<.5);
            if(transform){
                cpage.style[transform]='skew'+name+'('+cp*180+'deg)'+fire3D;
                cpage.style.zIndex=zIndex;
                if(tpage){
                    tpage.style[transform]='skew'+name+'('+tp*180+'deg)'+fire3D;
                    tpage.style.zIndex=1-zIndex;
                }
            }else transitionLib['scroll'+name].apply(this,arguments);
        }

        $.each(" Reverse In Out".split(" "),function(i, type){
            transitionLib['scrollCover'+type+name]=function(cpage,cp,tpage,tp){
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

            transitionLib['slideCover'+type+name]=function(cpage,cp,tpage,tp){
                var prop=name||['X','Y'][this.direction],
                    zIndex=Number(type=='In'||!type&&cp<0||type=='Reverse'&&cp>0);
                if(transform){
                    cpage.style[transform]='translate'+prop+'('+cp*(100-zIndex*100)+'%) scale('+((1-Math.abs(zIndex&&cp))*.2+.8)+')'+fire3D;
                    cpage.style.zIndex=1-zIndex;
                    if(tpage){
                        tpage.style[transform]='translate'+prop+'('+tp*zIndex*100+'%) scale('+((1-Math.abs(zIndex?0:tp))*.2+.8)+')'+fire3D;
                        tpage.style.zIndex=zIndex;
                    }
                }else transitionLib['scrollCover'+type+name].apply(this,arguments);
            }

            transitionLib['flowCover'+type+name]=function(cpage,cp,tpage,tp){
                var prop=name||['X','Y'][this.direction],
                    zIndex=Number(type=='In'||!type&&cp<0||type=='Reverse'&&cp>0);
                if(transform){
                    cpage.style[transform]='translate'+prop+'('+cp*(100-zIndex*50)+'%) scale('+((1-Math.abs(cp))*.5+.5)+')'+fire3D;
                    cpage.style.zIndex=1-zIndex;
                    if(tpage){
                        tpage.style[transform]='translate'+prop+'('+tp*(50+zIndex*50)+'%) scale('+((1-Math.abs(tp))*.5+.5)+')'+fire3D;
                        tpage.style.zIndex=zIndex;
                    }
                }else transitionLib['scrollCover'+type+name].apply(this,arguments);
            }

            transitionLib['flipCover'+type+name]=function(cpage,cp,tpage,tp){
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
                }else transitionLib['scroll'+name].apply(this,arguments);
            }

            transitionLib['skewCover'+type+name]=function(cpage,cp,tpage,tp){
                var zIndex=Number(type=='In'||!type&&cp<0||type=='Reverse'&&cp>0);
                if(transform){
                    zIndex?cp=0:tp=0;
                    cpage.style[transform]='skew'+name+'('+cp*90+'deg)'+fire3D;
                    cpage.style.zIndex=1-zIndex;
                    if(tpage){
                        tpage.style[transform]='skew'+name+'('+tp*90+'deg)'+fire3D;
                        tpage.style.zIndex=zIndex;
                    }
                }else transitionLib['scroll'+name].apply(this,arguments);
            }

            transitionLib['zoomCover'+type+name]=function(cpage,cp,tpage,tp){
                var zIndex=Number(type=='In'||!type&&cp<0||type=='Reverse'&&cp>0);
                if(transform){
                    zIndex?cp=0:tp=0;
                    cpage.style[transform]='scale'+name+'('+(1-Math.abs(cp))+')'+fire3D;
                    cpage.style.zIndex=1-zIndex;
                    if(tpage){
                        tpage.style[transform]='scale'+name+'('+(1-Math.abs(tp))+')'+fire3D;
                        tpage.style.zIndex=zIndex;
                    }
                }else transitionLib['scroll'+name].apply(this,arguments);
            }

            transitionLib['bombCover'+type+name]=function(cpage,cp,tpage,tp){
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
                }else transitionLib['scroll'+name].apply(this,arguments);
            }
        });
    });

    return transitionLib;
})();