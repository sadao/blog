//to generate the collapsible button
YAHOO.util.Event.onDOMReady(function() {
    var Dom = YAHOO.util.Dom;
    var Event = YAHOO.util.Event;
    var grid_blog = Dom.get("grid_blog");
    var grid_menu_right = Dom.get("grid_menu_right");
    var blogcontainer = Dom.get("blogcontainer");

    //collapse bar
    var collapse = document.createElement("div");
    grid_blog.appendChild(collapse);

    //arrow
    var arrow = document.createElement("div");
    grid_blog.appendChild(arrow);

    collapse.innerHTML = " ";
    collapse.className = "gc-collapsible";

    var renderCollapse = function(e){
        var grid_blog_right_x = Dom.getX(grid_blog) + grid_blog.offsetWidth;
        Dom.setX(collapse, grid_blog_right_x,true);
        Dom.setY(collapse, Dom.getY(grid_blog));
        var height_ = Dom.getStyle(grid_blog, "height");
        if (height_ != "auto") {
            Dom.setStyle(collapse, "height", Dom.getStyle(grid_blog, "height"));
        } else {
            Dom.setStyle(collapse, "height", grid_blog.offsetHeight); //fix for bug of IE.
        }
        arrow.innerHTML = " ";
        arrow.className = "gc-collapsible-arrow";
        Dom.setX(arrow, grid_blog_right_x + 15);
        Dom.setStyle(arrow, "display", "none");
    };

    //binding the action to hide/show grid_menu_right.
    var hoverCollapse = function(e) {
        Dom.setStyle(collapse, "border", "1px solid #D3D9E5");
        Dom.setStyle(collapse, "width", "6px");
        //show arrow.
        Dom.setY(arrow, e.clientY+ document.documentElement.scrollTop+document.body.scrollTop);
        if(Dom.getStyle(grid_menu_right, "display") != "none"){
            arrow.className = "gc-collapsible-arrow-collapsed";
        }else{
            arrow.className = "gc-collapsible-arrow";
        }
        Dom.setStyle(arrow, "display", "");
    };
    var mouseoutCollapse = function(e) {
        Dom.setStyle(collapse, "border", "none");
        Dom.setStyle(collapse, "width", "4px");
        //hide the arrow
        Dom.setStyle(arrow, "display", "none");
    };

    var doCollapse = function(e) {
        var height_ = Dom.getStyle(grid_blog, "height");
        if (Dom.getStyle(grid_menu_right, "display") != "none") {
            blogcontainer.className = 'yui-g';
            grid_blog.className = "";
            grid_menu_right.className = "";
            grid_menu_right.style.display = "none";
            Dom.setX(collapse, Dom.getX(grid_blog) + grid_blog.offsetWidth);
            Dom.setY(collapse, Dom.getY(grid_blog));
            if (height_ != "auto") {
                Dom.setStyle(collapse, "height", Dom.getStyle(grid_blog, "height"));
            } else {
                Dom.setStyle(collapse, "height", grid_blog.offsetHeight);
            }
            Dom.setX(arrow, Dom.getX(grid_blog) + grid_blog.offsetWidth - 13);
        } else {
            blogcontainer.className = "yui-gc";
            grid_blog.className = "yui-u first";
            grid_menu_right.className = "yui-u";
            grid_menu_right.style.display = "";
            Dom.setX(collapse, Dom.getX(grid_blog) + grid_blog.offsetWidth);
            Dom.setY(collapse, Dom.getY(grid_blog));
            if (height_ != "auto") {
                Dom.setStyle(collapse, "height", Dom.getStyle(grid_blog, "height"));
            } else {
                Dom.setStyle(collapse, "height", grid_blog.offsetHeight);
            }
            Dom.setX(arrow, Dom.getX(grid_blog) + grid_blog.offsetWidth + 15);
        }
    };
    renderCollapse();
    Event.addListener(window, "resize", renderCollapse);
    Event.addListener(collapse, "mousemove", hoverCollapse);
    Event.addListener(collapse, "mouseout", mouseoutCollapse);
    Event.addListener(collapse, "click", doCollapse);
});