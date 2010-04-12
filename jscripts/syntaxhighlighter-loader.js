Array.prototype.contains = function (element) {
    for (var i = 0; i < this.length; i++) {
        if (this[i] == element) {
            return true;
        }
    }
    return false;
};

YAHOO.namespace("highlighter");
YAHOO.highlighter.loader = (function() {
    var brushMap = {js:"JScript",jscript:"JScript",javascript:"JScript",
        bash:"Bash",shell:"Bash",css:"Css",actionscript3:"AS3",as3:"AS3",cpp:"Cpp",c:"Cpp",
        csharp:"CSharp",groovy:"Groovy",java:"Java",javafx:"JavaFX",jfx:"JavaFX",
        perl:"Perl",pl:"Perl",php:"Php",text:"Plain",plain:"Plain",py:"Python",python:"Python",
        ruby:"Ruby",ror:"Ruby",rails:"Ruby",scala:"Scala",sql:"Sql",xml:"Xml",html:"Xml",xhtml:"Xml",xslt:"Xml"
    };

    function parseBrush() {
        var pres = document.getElementsByTagName("pre");
        var brushs = new Array();
        for (var i = 0; i < pres.length; i++) {
            var pre = pres[i];
            var className = pre.className;
            className = className.toLowerCase();
            var brush = null;
            if (className.indexOf('brush:') == 0) {
                brush = className.substr(className.indexOf(':') + 1);
            } else if (pre.getAttribute('name') == 'code') {
                brush = className;
                pre.className = 'brush:' + className;
            }
            if (brush == null)
                continue;
            if (!eval("brushMap." + brush)) {
                pre.className = 'brush:text';
                brush = "text";
            }
            if (!brushs.contains(brush)) {
                brushs.push(brush);
            }
        }
        return brushs;
    }
    return {
        loadLibs : function(baseurl, _theme) {
            var resources = [];
            var theme = _theme || "Default";
            var brushs = parseBrush();
            if (brushs.length == 0)
                return;
            YAHOO.util.Get.css([baseurl + "styles/shCore.css", baseurl + "styles/shTheme" + theme + ".css"]);
            resources.push(baseurl + 'scripts/shCore.js');
            for (var i = 0; i < brushs.length; i++) {
                var lib = brushs[i];
                lib = eval("brushMap." + lib);
                resources.push(baseurl + "scripts/shBrush" + lib + ".js");
            }
            var callback = function() {
                SyntaxHighlighter.config.clipboardSwf = baseurl + 'scripts/clipboard.swf';
                SyntaxHighlighter.highlight();
            };
            YAHOO.util.Get.script(resources, {onSuccess:callback});
        }
    };
})();