YAHOO.util.Event.onDOMReady(function() {
    var myColumnDefs = [
        {key:"check",resizeable:true,label:"",formatter:YAHOO.widget.DataTable.formatCheckbox,className:"align_center"},
        {key:"title",label:"Title",sortable:true,editor:"textbox"},
        {key:"permalink",label:"Permalink",sortable:true,editor:"textbox"},
        {key:"target",label:"Target",sortable:true,editor:"dropdown",editorOptions:{dropdownOptions:["_self","_blank","_parent","_top"]}},
        {key:"order",label:"Order",formatter:YAHOO.widget.DataTable.formatNumber,sortable:true,editor:"textbox",editorOptions:{validator:YAHOO.widget.DataTable.validateNumber}},
        {key:"valid",label:"Valid",sortable:true,editor:"radio",editorOptions:{radioOptions:[true,false],disableBtns:true}}
   ];

    var myDataSource = new YAHOO.util.DataSource("/rpc?action=GetMenus");
    myDataSource.responseType = YAHOO.util.DataSource.TYPE_JSON;
    myDataSource.responseSchema = {
        resultsList: "records",        
        fields: [{key:"title"},{key:"permalink"},{key:"target"},
            {key:"order", parser:YAHOO.util.DataSource.parseNumber},
            {key:"valid"}, {key:"id"}, {key:"key"}
        ]
    };
    var myDataTable = new YAHOO.widget.DataTable("menudiv", myColumnDefs, myDataSource,
    { sortedBy:{key:"order",dir:"asc"}});

    myDataTable.updateMethod = "UpdateMenu";

    // Set up editing flow
    this.highlightEditableCell = function(oArgs) {
        var elCell = oArgs.target;
        if (YAHOO.util.Dom.hasClass(elCell, "yui-dt-editable")) {
            this.highlightCell(elCell);
        }
    };
    myDataTable.subscribe("cellMouseoverEvent", this.highlightEditableCell);
    myDataTable.subscribe("cellMouseoutEvent", myDataTable.onEventUnhighlightCell);
    myDataTable.subscribe("cellClickEvent", myDataTable.onEventShowCellEditor);
    
    // Selects any cell that receives a checkbox click
    myDataTable.subscribe("checkboxClickEvent", function(oArgs) {
        var elCheckbox = oArgs.target;
        var elRow = this.getTrEl(elCheckbox);
        if (elCheckbox.checked) {
            this.selectRow(elRow);
        } else {
            this.unselectRow(elRow);
        }
    });

    // Hook into custom event to customize save-flow of "radio" editor
    myDataTable.subscribe("editorUpdateEvent", function(oArgs) {
        if (oArgs.editor.column.key === "valid") {
            this.saveCellEditor();
        }
    });
    myDataTable.subscribe("editorBlurEvent", function(oArgs) {
        this.cancelCellEditor();
    });

    var addMenu = function(e,obj) {
        YAHOO.util.Connect.asyncRequest('GET', '/rpc?action=AddMenu&arg0=\"'+encodeURIComponent(obj[0])+'\"&arg1=\"'+encodeURIComponent(obj[1])+'\"',
        {
            success: function (o) {
                var index = myDataTable.getRecordSet().getLength();
                var record = YAHOO.lang.JSON.parse(o.responseText);
                myDataTable.addRow(record, index);
            },
            failure: function (o) {
                alert(o.statusText);
            },
            scope:this
        }
                );
    };

    YAHOO.util.Event.addListener("add_menu_btn", "click", addMenu,['New Menu','New permalink']);
    YAHOO.util.Event.addListener("add_menu_album_btn", "click", addMenu,['Albums','/albums']);

    var addProfileMenu = function(e) {
        var profile_id = YAHOO.util.Dom.get("profile_id");
        if (profile_id.value.trim() == "") {
            alert("Please input the Google profile user id.");
            profile_id.focus();
        } else {
            addMenu(e,["Profile","/profiles/"+encodeURIComponent(profile_id.value)]);
        }
    };
    var addBookMenu = function(e) {
        var book_id = YAHOO.util.Dom.get("book_id");
        if (book_id.value.trim() == "") {
            alert("Please input the Google books user id.");
            book_id.focus();
        } else {
            addMenu(e,["My library","/books/"+encodeURIComponent(book_id.value)]);
        }
    };

    YAHOO.util.Event.addListener("add_menu_profile_btn", "click", addProfileMenu);
    YAHOO.util.Event.addListener("add_menu_book_btn", "click", addBookMenu);

    var selectedMenuIds = function(recordSet, selectedRows) {
        var _keys = "menu_keys=";
        for (var x = 0, length = selectedRows.length; x < length; x++) {
            var record = recordSet.getRecord(selectedRows[x]);
            _keys += record.getData().key;
            if (x < length - 1) {
                _keys += ",";
            }
        }
        return _keys;
    };

    var deleteMenus = function() {
        var selected = myDataTable.getSelectedRows();
        var rset = myDataTable.getRecordSet();
        if (selected.length > 0) {
            if (confirm('Are you sure to delete the menu(s)?')) {
                YAHOO.util.Connect.asyncRequest('POST', '/rpc?action=DeleteMenu',
                {
                    success: function (o) {
                        if (o.responseText == 'true') {
                            for (var x = 0; x < selected.length; x++) {
                                myDataTable.deleteRow(rset.getRecordIndex(rset.getRecord(selected[x])));
                            }
                        } else {
                            alert(o.responseText);
                        }
                    },
                    failure: function (o) {
                        alert(o.statusText);
                    },
                    scope:this
                }, selectedMenuIds(rset, selected)
                        );
            }
        } else {
            alert("Please select at least one Menu to delete.");
        }
    };
    YAHOO.util.Event.addListener("delete_menu_btn", "click", deleteMenus);
});
