YAHOO.util.Event.onContentReady("yui-main",function() {
    //get all the images in blogcontent div.
    var blog_div = YAHOO.util.Dom.get("yui-main");
    var images = blog_div.getElementsByTagName("img");
    for (var i = 0,len = images.length; i < len; i++) {
        var img = images[i];
        var img_div = YAHOO.util.Dom.getAncestorByTagName(img,"div");
        var div_width = img_div.offsetWidth;
        //var div_width = width_.substring(0,width_.length-2);
        if (img.width > div_width) {
            img.width = div_width;
            //add url for the resized image.
            var a_ = document.createElement("a");
            a_.href = img.src;
            a_.target = "_blank";
            YAHOO.util.Dom.insertAfter(a_,img);
            a_.appendChild(img);
        }
    }
});