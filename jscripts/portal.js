//Use loader to grab the modules needed
YUI(yuiConfig).use('dd', 'anim', 'anim-easing', 'io', 'cookie', 'json', function(Y) {
    //Y.DD.DDM._debugShim = true;

    //Setup some private variables..
    var goingUp = false, lastY = 0, trans = {};

    //The list of feeds that we are going to use
    var drag_divs = Y.all("div.div_cpedialog");

    var feeds = {
/*
        'ynews': {
            id: 'ynews',
            title: 'Yahoo! US News',
            url: 'rss.news.yahoo.com/rss/us'
        }
*/
    };

    //Setup the config for IO to use flash
    Y.io.transport({
        id: 'flash',
        yid: Y.id,
        src: '/img/io.swf?stamp=' + (new Date()).getTime()
    });

    //Simple method for stopping event propagation
    //Using this so we can unsubscribe it later
    var stopper = function(e) {
        e.stopPropagation();
    };

    //Get the order, placement and minned state of the modules and save them to a cookie
    var _setCookies = function() {
        var dds = Y.DD.DDM._drags;
        var list = {};
        //Walk all the drag elements
        Y.each(dds, function(v, k) {
            var par = v.get('node').get('parentNode');
            //Find all the lists with drag items in them
            if (par.test('ul.list')) {
                if (!list[par.get('id')]) {
                    list[par.get('id')] = [];
                }
            }
        });
        //Walk the list
        Y.each(list, function(v, k) {
            //Get all the li's in the list
            var lis = Y.all('#' + k + ' li.item');
            lis.each(function(v2, k2) {
                //Get the drag instance for the list item
                var dd = Y.DD.DDM.getDrag('#' + v2.get('id'));
                //Get the mod node
                var mod = dd.get('node').query('div.mod');
                //Is it minimized
                var min = (mod.hasClass('minned')) ? true : false;
                //Setup the cookie data

                var data = dd.get('data');
                var dataId;
                if (typeof(data.id) != "undefined") {
                    dataId = data.id;
                } else {
                    dataId = data.get('id');
                }

                list[k][list[k].length] = { id: dataId, min: min };
            });
        });
        //JSON encode the cookie data
        var cookie = Y.JSON.stringify(list);
        //Set the sub-cookie
        Y.Cookie.setSub('cpedialog', 'portal', cookie);
    };

    //Helper method for creating the feed DD on the left
    var _createFeedDD = function(node, data) {
        //Create the DD instance
        var dd = new Y.DD.Drag({
            node: node,
            data: data,
            bubbles: Y.Portal
        }).plug(Y.Plugin.DDProxy, {
            moveOnEnd: false,
            borderStyle: 'none'
        });
        //Setup some stopper events
        dd.on('drag:start', _handleStart);
        dd.on('drag:end', stopper);
        dd.on('drag:drophit', stopper);
    };



    //Handle the node:click event
    /* {{{ */
    var _nodeClick = function(e) {
        //Is the target an href?
        if (e.target.test('a')) {
            var a = e.target, anim = null, div = a.get('parentNode').get('parentNode');
            //Did they click on the min button
            if (a.hasClass('min')) {
                //Get some node references
                var ul = div.query('ul'),
                        h2 = div.query('div_cpedialog'),
                        h = h2.get('offsetHeight'),
                        hUL = ul.get('offsetHeight'),
                        inner = div.query('div.inner');

                //Create an anim instance on this node.
                anim = new Y.Anim({
                    node: inner
                });
                //Is it expanded?
                if (!div.hasClass('minned')) {
                    //Set the vars for collapsing it
                    anim.setAtts({
                        to: {
                            height: 0
                        },
                        duration: '.25',
                        easing: Y.Easing.easeOut,
                        iteration: 1
                    });
                    //On the end, toggle the minned class
                    //Then set the cookies for state
                    anim.on('end', function() {
                        div.toggleClass('minned');
                        _setCookies();
                    });
                } else {
                    //Set the vars for expanding it
                    anim.setAtts({
                        to: {
                            height: (hUL)
                        },
                        duration: '.25',
                        easing: Y.Easing.easeOut,
                        iteration: 1
                    });
                    //Toggle the minned class
                    //Then set the cookies for state
                    div.toggleClass('minned');
                    _setCookies();
                }
                //Run the animation
                anim.run();

            }
            //Was close clicked?
            if (a.hasClass('close')) {
                //Get some Node references..
                var li = div.get('parentNode'),
                        id = li.get('id'),
                        dd = Y.DD.DDM.getDrag('#' + id),
                        data = dd.get('data');
                var dataId;
                if (typeof(data.id) != "undefined") {
                    dataId = data.id;
                } else {
                    dataId = data.get('id');
                }
                var item = Y.Node.get('#' + dataId);

                //Destroy the DD instance.
                dd.destroy();
                //Setup the animation for making it disappear
                anim = new Y.Anim({
                    node: div,
                    to: {
                        opacity: 0
                    },
                    duration: '.25',
                    easing: Y.Easing.easeOut
                });
                anim.on('end', function() {
                    //On end of the first anim, setup another to make it collapse
                    var anim = new Y.Anim({
                        node: div,
                        to: {
                            height: 0
                        },
                        duration: '.25',
                        easing: Y.Easing.easeOut
                    });
                    anim.on('end', function() {
                        //Remove it from the document
                        li.get('parentNode').removeChild(li);
                        item.removeClass('disabled');
                        //Setup a drag instance on the feed list
                        _createFeedDD(item, data);
                        _setCookies();

                    });
                    //Run the animation
                    anim.run();
                });
                //Run the animation
                anim.run();
            }
            //Stop the click
            e.halt();
        }
    };
    /* }}} */

    //This creates the module, either from a drag event or from the cookie load
    var setupModDD = function(mod, data, dd) {
        var node = mod;
        //Listen for the click so we can react to the buttons
        node.query('h2').on('click', _nodeClick);

        //It's a target
        dd.set('target', true);
        //Remove the event's on the original drag instance
        dd.unsubscribe('drag:start', stopper);
        dd.unsubscribe('drag:end', stopper);
        dd.unsubscribe('drag:drophit', stopper);

        //Setup the handles
        dd.addHandle('h2').addInvalid('a');
        //Remove the mouse listeners on this node
        dd._unprep();
        //Update a new node
        dd.set('node', mod);
        //Reset the mouse handlers
        dd._prep();

        //only queue for the feed drag.
        if (typeof(data.title) != "undefined") {
            //The Yahoo! Pipes URL
            var url = 'http:/' + '/pipes.yahooapis.com/pipes/pipe.run?_id=6b7b2c6a32f5a12e7259c36967052387&_render=json&url=http:/' + '/' + data.url;
            //Start the XDR request
            var id = Y.io(url, {
                method: 'GET',
                xdr: {
                    use:'flash'
                },
                //XDR Listeners
                on: {
                    success: function(id, data) {
                        //On success get the feed data
                        var d = feeds[trans[id]],
                            //Node reference
                                inner = d.mod.query('div.inner'),
                            //Parse the JSON data
                                oRSS = Y.JSON.parse(data.responseText),
                                html = '';

                        //Did we get data?
                        if (oRSS && oRSS.count) {
                            //Walk the list and create the news list
                            Y.each(oRSS.value.items, function(v, k) {
                                if (k < 5) {
                                    html += '<li><a href="' + v.link + '" target="_blank">' + v.title + '</a>';
                                }
                            });
                        }
                        //Set the innerHTML of the module
                        inner.set('innerHTML', '<ul>' + html + '</ul>');
                        if (Y.DD.DDM.activeDrag) {
                            //If we are still dragging, update the proxy element too..
                            var proxy_inner = Y.DD.DDM.activeDrag.get('dragNode').query('div.inner');
                            proxy_inner.set('innerHTML', '<ul>' + html + '</ul>');

                        }
                    },
                    failure: function(id, data) {
                        //Something failed..
                        alert('Feed failed to load..' + id + ' :: ' + data);
                    }
                }
            });
            //Keep track of the transaction
            feeds[data.id].trans = id;
            feeds[data.id].mod = mod;
            trans[id.id] = data.id;
        }
    };


    //Helper method to create the markup for the module..
    var createMod = function(data) {
        var title = "";
        var content = '<div class="loading">Feed loading, please wait..</div>';
        if (typeof(data.title) != "undefined") {  //for feed mod.
            title = data.title;
        } else {
            title = data.get('title');  //for div mod.
            content = data.get('innerHTML') ;
            //todo:
            while(content.indexOf('<script')!=-1){
             content = content.replace()('<script','<!--script');
            }
            while(content.indexOf('</script>')!=-1){
            content = content.replace('</script>','</script-->');
            }
        }
        var str = '<li class="item">' +
                  '<div class="mod">' +
                  '<h2><strong>' + title + '</strong> <a title="minimize module" class="min" href="#"> </a>' +
                  '<a title="close module" class="close" href="#"></a></h2>' +
                  '<div class="inner">' +  content +
                  '</div>' +
                  '</div>' +
                  '</li>';
        return Y.Node.create(str);
    };

    //Handle the start Drag event on the left side
    var _handleStart = function(e) {
        //Stop the event
        stopper(e);
        //Some private vars
        var drag = this,
                list3 = Y.Node.get('#list1'),
                mod = createMod(drag.get('data'));

        //Add it to the first list
        list3.appendChild(mod);
        //Set the item on the left column disabled.
        drag.get('node').addClass('disabled');
        //Set the node on the instance
        drag.set('node', mod);
        //Add some styles to the proxy node.
        drag.get('dragNode').setStyles({
            opacity: '.5',
            borderStyle: 'none',
            width: '320px',
            height: '61px'
        });
        //Update the innerHTML of the proxy with the innerHTML of the module
        drag.get('dragNode').set('innerHTML', drag.get('node').get('innerHTML'));
        //set the inner module to hidden
        drag.get('node').query('div.mod').setStyle('visibility', 'hidden');
        //add a class for styling
        drag.get('node').addClass('moving');
        //Setup the DD instance
        setupModDD(mod, drag.get('data'), drag);

        //Remove the listener
        this.unsubscribe('drag:start', _handleStart);
    };


    //Walk through the feeds list and create the list on the left
    var feedList = Y.Node.get('#feeds ul');
    Y.each(feeds, function(v, k) {
        var li = Y.Node.create('<li id="' + k + '">' + v.title + '</li>');
        feedList.appendChild(li);
        //Create the DD instance for this item
        _createFeedDD(li, v);
    });

    Y.each(drag_divs, function(v, k, items) {
        var div_ = items.item(k);
        var li = Y.Node.create('<li id="' + div_.get("id") + '">' + div_.get("title") + '</li>');
        feedList.appendChild(li);
        //Create the DD instance for this item
        div_.setAttribute("id",div_.get("id"));
        _createFeedDD(li, div_);
    });

    //This does the calculations for when and where to move a module
    var _moveMod = function(drag, drop) {
        if (drag.get('node').hasClass('item')) {
            var dragNode = drag.get('node'),
                    dropNode = drop.get('node'),
                    append = false,
                    padding = 30,
                    xy = drag.mouseXY,
                    region = drop.region,
                    middle1 = region.top + ((region.bottom - region.top) / 2),
                    middle2 = region.left + ((region.right - region.left) / 2),
                    dir = false,
                    dir1 = false,
                    dir2 = false;

            //We could do something a little more fancy here, but we won't ;)
            if ((xy[1] < (region.top + padding))) {
                dir1 = 'top';
            }
            if ((region.bottom - padding) < xy[1]) {
                dir1 = 'bottom';
            }
            if ((region.right - padding) < xy[0]) {
                dir2 = 'right';
            }
            if ((xy[0] < (region.left + padding))) {
                dir2 = 'left';
            }
            dir = dir2;
            if (dir2 === false) {
                dir = dir1;
            }
            switch (dir) {
                case 'top':
                    var next = dropNode.get('nextSibling');
                    if (next) {
                        dropNode = next;
                    } else {
                        append = true;
                    }
                    break;
                case 'bottom':
                    break;
                case 'right':
                case 'left':
                    break;
            }


            if ((dropNode !== null) && dir) {
                if (dropNode && dropNode.get('parentNode')) {
                    if (!append) {
                        dropNode.get('parentNode').insertBefore(dragNode, dropNode);
                    } else {
                        dropNode.get('parentNode').appendChild(dragNode);
                    }
                }
            }
            //Resync all the targets because something moved..
            Y.Lang.later(50, Y, function() {
                Y.DD.DDM.syncActiveShims(true);
            });
        }
    };

    /*
     Handle the drop:enter event
     Now when we get a drop enter event, we check to see if the target is an LI, then we know it's out module.
     Here is where we move the module around in the DOM.
     */
    Y.DD.DDM.on('drop:enter', function(e) {
        if (!e.drag || !e.drop || (e.drop !== e.target)) {
            return false;
        }
        if (e.drop.get('node').get('tagName').toLowerCase() === 'li') {
            if (e.drop.get('node').hasClass('item')) {
                _moveMod(e.drag, e.drop);
            }
        }
    });

    //Handle the drag:drag event
    //On drag we need to know if they are moved up or down so we can place the module in the proper DOM location.
    Y.DD.DDM.on('drag:drag', function(e) {
        var y = e.target.mouseXY[1];
        if (y < lastY) {
            goingUp = true;
        } else {
            goingUp = false;
        }
        lastY = y;
    });

    /*
     Handle the drop:hit event
     Now that we have a drop on the target, we check to see if the drop was not on a LI.
     This means they dropped on the empty space of the UL.
     */
    Y.DD.DDM.on('drag:drophit', function(e) {
        var drop = e.drop.get('node'),
                drag = e.drag.get('node');

        if (drop.get('tagName').toLowerCase() !== 'li') {
            if (!drop.contains(drag)) {
                drop.appendChild(drag);
            }
        }
    });

    //Handle the drag:start event
    //Use some CSS here to make our dragging better looking.
    Y.DD.DDM.on('drag:start', function(e) {
        var drag = e.target;
        if (drag.target) {
            drag.target.set('locked', true);
        }
        drag.get('dragNode').set('innerHTML', drag.get('node').get('innerHTML'));
        drag.get('dragNode').setStyle('opacity', '.5');
        drag.get('node').query('div.mod').setStyle('visibility', 'hidden');
        drag.get('node').addClass('moving');
    });

    //Handle the drag:end event
    //Replace some of the styles we changed on start drag.
    Y.DD.DDM.on('drag:end', function(e) {
        var drag = e.target;
        if (drag.target) {
            drag.target.set('locked', false);
        }
        drag.get('node').setStyle('visibility', '');
        drag.get('node').query('div.mod').setStyle('visibility', '');
        drag.get('node').removeClass('moving');
        drag.get('dragNode').set('innerHTML', '');
        _setCookies();
    });


    //Handle going over a UL, for empty lists
    Y.DD.DDM.on('drop:over', function(e) {
        var drop = e.drop.get('node'),
                drag = e.drag.get('node');

        if (drop.get('tagName').toLowerCase() !== 'li') {
            if (!drop.contains(drag)) {
                drop.appendChild(drag);
                Y.Lang.later(50, Y, function() {
                    Y.DD.DDM.syncActiveShims(true);
                });
            }
        }
    });

    //Create simple targets for the main lists..
    var uls = Y.all('ul.list');
    uls.each(function(v, k, items) {
        var tar = new Y.DD.Drop({
            node: items.item(k),
            padding: '20 0'
        });
    });


    Y.on('io:xdrReady', function() {
        //Get the cookie data
        var cookie = Y.Cookie.getSub('cpedialog', 'portal');
        if (cookie) {
            //JSON parse the stored data
            var obj = Y.JSON.parse(cookie);

            //Walk the data
            Y.each(obj, function(v, k) {
                //Get the node for the list
                var list = Y.Node.get('#' + k);
                //Walk the items in this list
                Y.each(v, function(v2, k2) {
                    //Get the drag for it
                    var drag = Y.DD.DDM.getDrag('#' + v2.id);
                    //Create the module
                    var mod = createMod(drag.get('data'));
                    if (v2.min) {
                        //If it's minned add some CSS
                        mod.query('div.mod').addClass('minned');
                        mod.query('div.inner').setStyle('height', '0px');
                    }
                    //Add it to the list
                    list.appendChild(mod);
                    //Set the drag listeners
                    drag.get('node').addClass('disabled');
                    drag.set('node', mod);
                    drag.set('dragNode', Y.DD.DDM._proxy);
                    drag.unsubscribe('drag:start', _handleStart);
                    drag.unsubscribe('drag:end', stopper);
                    drag.unsubscribe('drag:drophit', stopper);
                    drag._unprep();
                    //Setup the new Drag listeners
                    setupModDD(mod, drag.get('data'), drag);
                });
            });
        }
    });

    //delete the drags in the specified drop, use for deleting the drags in '#list3' when switch one column body split content. 
    var deleteDragsInDrop = function(listId) {
        var list_ = Y.Node.get('#' + listId);
        var lis = Y.all('#' + listId + ' li.item');
        lis.each(function(v2, k2) {
            //Get the drag instance for the list item
            var dd = Y.DD.DDM.getDrag('#' + v2.get('id'));
            var data = dd.get('data');
            var dataId;
            if (typeof(data.id) != "undefined") {
                dataId = data.id;
            } else {
                dataId = data.get('id');
            }
            var item = Y.Node.get('#' + dataId);

            v2.get('parentNode').removeChild(v2);
            item.removeClass('disabled');

            //Destroy the DD instance.
            dd.destroy();
            _createFeedDD(item, data);
        });
        _setCookies();
    };


    //gridbuilder: CSSGridBuilder for the layout reset feature. the part below use yui 2.6.0
    var Dom = YAHOO.util.Dom,
            Event = YAHOO.util.Event;

    YAHOO.CSSGridBuilder = {
        init: function() {
            var cookie = Y.Cookie.getSub('cpedialog', 'layout');
            if (cookie) {
                //JSON parse the stored data
                var obj = Y.JSON.parse(cookie);
                Dom.get('which_doc').options.selectedIndex = obj[0];  //950px
                Dom.get('which_grid').options.selectedIndex = obj[1]; //yui-t5
                Dom.get('splitBody0').options.selectedIndex = obj[2];  //yui-gc
            } else {
                Dom.get('which_doc').options.selectedIndex = 1;  //950px
                Dom.get('which_grid').options.selectedIndex = 4; //yui-t5
                Dom.get('splitBody0').options.selectedIndex = 2;  //yui-gc
            }

            this.type = Dom.get('which_grid').options[Dom.get('which_grid').options.selectedIndex].value;
            this.docType = Dom.get('which_doc').options[Dom.get('which_doc').options.selectedIndex].value;
            this.sliderData = false;
            this.bd = Dom.get('bd');
            this.doc = Dom.get("doc2");
            this.template = Dom.get('which_grid');

            Event.on(this.template, 'change', YAHOO.CSSGridBuilder.changeType, YAHOO.CSSGridBuilder, true);
            Event.on('splitBody0', 'change', YAHOO.CSSGridBuilder.splitBody, YAHOO.CSSGridBuilder, true);
            Event.on('which_doc', 'change', YAHOO.CSSGridBuilder.changeDoc, YAHOO.CSSGridBuilder, true);
            var reset_button = new YAHOO.widget.Button('resetBuilder');
            var save_button = new YAHOO.widget.Button('saveLayout');
            reset_button.on('click', YAHOO.CSSGridBuilder.reset, YAHOO.CSSGridBuilder, true);
            save_button.on('click', YAHOO.CSSGridBuilder.save, YAHOO.CSSGridBuilder, true);

            //this.changeDoc();
            this.changeType();
            this.splitBody();
            if (this.docType == 'custom-doc') {
                this.doc.id = this.docType;
                this.doc.style.width = obj[3];
            }else{
                this.doc.style.width = '';
                this.doc.style.minWidth = '';
                this.sliderData = false;
                this.doc.id = this.docType;
            }
        },
        reset: function(ev) {
            Dom.get('which_doc').options.selectedIndex = 1;  //950px
            Dom.get('which_grid').options.selectedIndex = 4; //yui-t5
            Dom.get('splitBody0').options.selectedIndex = 2;  //yui-gc

            this.changeDoc();
            this.changeType();
            this.splitBody();
            Event.stopEvent(ev);
            this.setLayoutCookies();
        },
        save: function(ev) {
            var cookie_dd = Y.Cookie.getSub('cpedialog', 'portal');
            var cookie_grid = Y.Cookie.getSub('cpedialog', 'layout');
            var sUrl = "/rpc?action=UpdateLayout&dd=" + encodeURIComponent(cookie_dd) + "&grid=" + encodeURIComponent(cookie_grid) +
                       "&time=" + new Date().getTime();
            var updateLayoutSuccess = function(o) {
                if (o.responseText !== undefined) {
                    alert("Update Layout successfully.");
                }
            }
            var callback =
            {
                success:updateLayoutSuccess,
                failure:handleFailure
            };
            YAHOO.util.Connect.asyncRequest('POST', sUrl, callback);
        },
        changeDoc: function(ev) {
            this.docType = Dom.get('which_doc').options[Dom.get('which_doc').selectedIndex].value;
            if (this.docType == 'custom-doc') {
                this.showSlider();
            } else {
                this.doc.style.width = '';
                this.doc.style.minWidth = '';
                this.sliderData = false;
                this.doc.id = this.docType;
            }
            if (ev) {
                Event.stopEvent(ev);
            }
            this.setLayoutCookies();
        },
        changeType: function() {
            this.type = this.template.options[this.template.selectedIndex].value;
            this.doc.className = this.type;
            this.setLayoutCookies();
        },
        splitBody: function() {
            this.splitBodyTemplate(Dom.get('splitBody0'));
            this.setLayoutCookies();
        },
        splitBodyTemplate: function(tar) {
            var mainblock = Dom.get('div_mainblock');
            var mainblock_sub1 = Dom.get('div_mainblock_sub1');
            var mainblock_sub2 = Dom.get('div_mainblock_sub2');
            if (tar) {
                var bSplit = tar.options[tar.selectedIndex].value;
                switch (bSplit) {
                    case '1':
                        mainblock.className = 'yui-g';
                        mainblock_sub1.className = "";
                        mainblock_sub2.className = "";
                        mainblock_sub2.style.display = "none";
                        deleteDragsInDrop("list3");
                        break;
                    case '2':
                        mainblock.className = "yui-g";
                        mainblock_sub1.className = "yui-u first";
                        mainblock_sub2.className = "yui-u";
                        mainblock_sub2.style.display = "";
                        break;
                    case '3':
                        mainblock.className = "yui-gc";
                        mainblock_sub1.className = "yui-u first";
                        mainblock_sub2.className = "yui-u";
                        mainblock_sub2.style.display = "";
                        break;
                    case '4':
                        mainblock.className = "yui-gd";
                        mainblock_sub1.className = "yui-u first";
                        mainblock_sub2.className = "yui-u";
                        mainblock_sub2.style.display = "";
                        break;
                    case '5':
                        mainblock.className = "yui-ge";
                        mainblock_sub1.className = "yui-u first";
                        mainblock_sub2.className = "yui-u";
                        mainblock_sub2.style.display = "";
                        break;
                    case '6':
                        mainblock.className = "yui-gf";
                        mainblock_sub1.className = "yui-u first";
                        mainblock_sub2.className = "yui-u";
                        mainblock_sub2.style.display = "";
                        break;
                }
            }
        },

        //store the layout to cookie
        setLayoutCookies: function() {
            var list = {};
            var which_doc = Dom.get('which_doc').options.selectedIndex;
            var which_grid = Dom.get('which_grid').options.selectedIndex;
            var splitBody0 = Dom.get('splitBody0').options.selectedIndex;
            list[0] = which_doc;
            list[1] = which_grid;
            list[2] = splitBody0;
            if(which_doc==4){
                list[3] = this.doc.style.width;
            }
            //JSON encode the cookie data
            var cookie = Y.JSON.stringify(list);
            //Set the sub-cookie
            Y.Cookie.setSub('cpedialog', 'layout', cookie);
        },


        //show custom body size slider.
        showSlider: function() {
            var handleCancel = function() {
                showSlider.hide();
                return false;
            }
            var handleSubmit = function() {
                YAHOO.CSSGridBuilder.sliderData = Dom.get('sliderValue').value;

                showSlider.hide();
            }

            var myButtons = [
                { text:'Save', handler: handleSubmit, isDefault: true },
                { text:'Cancel', handler: handleCancel }
            ];

            var showSlider = new YAHOO.widget.Dialog('showSlider', {
                close: true,
                draggable: true,
                modal: true,
                visible: true,
                fixedcenter: true,
                width: '275px',
                zindex: 9001,
                postmethod: 'none',
                buttons: myButtons
            }
                    );
            showSlider.hideEvent.subscribe(function() {
                this.destroy();
            }, showSlider, true);
            showSlider.setHeader('Custom Body Size');
            var body = '<p>Adjust the slider below to adjust your body size or set it manually with the text input. <i>(Be sure to include the % or px in the text input)</i></p>';
            body += '<form name="customBodyForm" method="POST" action="">';
            body += '<p>Current Setting: <input type="text" id="sliderValue" value="100%" size="8" onfocus="this.select()" /></p>';
            body += '<span>Unit: ';
            body += '<input type="radio" name="movetype" id="moveTypePercent" value="percent" checked> <label for="moveTypePercent">Percent</label>&nbsp;';
            body += '<input type="radio" name="movetype" id="moveTypePixel" value="pixel"> <label for="moveTypePixel">Pixel</label></span>';
            body += '</form>';
            body += '<div id="sliderbg"><div id="sliderthumb"><img src="/img/thumb-n.gif" /></div>';
            body += '</div>';
            showSlider.setBody(body);


            var handleChange = function(f) {
                if (typeof f == 'object') {
                    f = slider.getValue();
                }
                if (Dom.get('moveTypePercent').checked) {
                    var w = Math.round(f / 2);
                    Dom.get('custom-doc').style.width = w + '%';
                    Dom.get('sliderValue').value = w + '%';
                } else {
                    var w = Math.round(f / 2);
                    var pix = Math.round(Dom.getViewportWidth() * (w / 100));
                    Dom.get('custom-doc').style.width = pix + 'px';
                    Dom.get('sliderValue').value = pix + 'px';
                }
                Dom.get('custom-doc').style.minWidth = '250px';
                YAHOO.CSSGridBuilder.setLayoutCookies();
            }

            var handleBlur = function() {
                f = Dom.get('sliderValue').value;
                if (f.indexOf('%') != -1) {
                    Dom.get('moveTypePercent').checked = true;
                    f = (parseInt(f) * 2);
                } else if (f.indexOf('px') != -1) {
                    Dom.get('moveTypePixel').checked = true;
                    f = (((parseInt(f) / Dom.getViewportWidth()) * 100) * 2);
                } else {
                    Dom.get('sliderValue').value = '100%';
                    f = 200;
                }
                slider.setValue(f);
            }

            showSlider.render(document.body);
            var slider = YAHOO.widget.Slider.getHorizSlider('sliderbg', 'sliderthumb', 0, 200, 1);
            slider.setValue(200);
            slider.onChange = handleChange;

            Event.on(['moveTypePercent', 'moveTypePixel'], 'click', handleChange);
            Event.on('sliderValue', 'blur', handleBlur);

            this.doc.id = this.docType;
            this.doc.style.width = '100%';
        }
    };

    var toolBox = new YAHOO.widget.Dialog('toolBoxHolder', {
        close: true,
        visible: false,
        x: 10,
        y: 10,
        zindex: 5000,
        width: '180px'//,
        //height: '482px'
    }
            );
    var kl2 = new YAHOO.util.KeyListener(document, { ctrl:true, keys:89 },
    { fn:toolBox.show,
        scope:toolBox,
        correctScope:true });
    kl2.enable();

    toolBox.render(document.body);
    toolBox.show();
    YAHOO.CSSGridBuilder.init();

});
