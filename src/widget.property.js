/*
 * This file is part of the RDFauthor project.
 * http://code.google.com/p/rdfauthor
 * Author: Norman Heino <norman.heino@gmail.com>
 * Author: Clemens Hoffmann <cannelony@gmail.com>
 */


RDFauthor.registerWidget({
    init: function () {
        this.results         = [];

        this._domReady     = false;
        this._pluginLoaded = false;
        this._initialized  = false;
        this._autocomplete = null;

        this._namespaces = jQuery.extend({
            foaf: 'http://xmlns.com/foaf/0.1/',
            dc:   'http://purl.org/dc/terms/',
            owl:  'http://www.w3.org/2002/07/owl#',
            rdf:  'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
            rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
            skos: 'http://www.w3.org/2004/02/skos/core#',
            geo:  'http://www.w3.org/2003/01/geo/wgs84_pos#',
            dbp:  'http://dbpedia.org/property/',
            xsd:  'http://www.w3.org/2001/XMLSchema#',
            sioc: 'http://rdfs.org/sioc/ns#'
        }, RDFauthor.namespaces());

        /* default options */
        this._options = jQuery.extend({
            // Autocomplete options:
            minChars:           3,      /* minmum chars needed to be typed before search starts */
            delay:              1000,   /* delay in ms before search starts */
            // Callbacks
            selectionCallback:  null,   /* the function to be called when a new selection is made */
            selectOnReturn:     false   /* executes selection callback if the user hits return in the search field */
        }, this.options);

        var self = this;
        if (undefined === jQuery.ui.autocomplete) {
            RDFauthor.loadScript(RDFAUTHOR_BASE + 'libraries/jquery.ui.autocomplete.js', function () {
                self._pluginLoaded = true;
                self._init();
            });
        } else {
            self._pluginLoaded = true;
            self._init();
        }

        // jQuery UI styles
        RDFauthor.loadStylesheet(RDFAUTHOR_BASE + 'libraries/jquery.ui.autocomplete.css');

        // load stylesheets
        RDFauthor.loadStylesheet(RDFAUTHOR_BASE + 'src/widget.property.css');

        // returns the size of an object
        Object.size = function(obj) {
            var size = 0, key;
            for (key in obj) {
                size++;
            }
            return size;
        }

    },

    ready: function () {
        this._domReady = true;
        this._init();
        this.element().trigger('click');
    },

    element: function () {
        return $('#property-input-' + this.ID);
    },

    markup: function () {
            var markup = '\
            <div class="container resource-value">\
                <input type="hidden" id="property-input-' + this.ID + '" name="propertpicker" class="text resource-edit-input" />\
            </div>';
            var propertyPicker = '\
                <div id="propertypicker" class="window ui-draggable ui-resizable" style="display: block;">\
                  <h1 class="title">Suggested Properties\
                    <br/>\
                    <input id="filterProperties" autocomplete="off" type="text" class="text inner-label width99" style="margin: 5px 5px 0px 0px;"/>\
                  </h1>\
                  <div class="window-buttons">\
                    <div class="window-buttons-left"></div>\
                    <div class="window-buttons-right">\
                      <span class="button button-windowclose"><span>\
                    </div>\
                  </div>\
                  <div class="content">\
                    <ul class="bullets-none separated">\
                      <li>\
                        <h1 class="propertyHeadline">\
                          <span style="display: inline-block !important;" class="ui-icon ui-icon-minus"></span>\
                          <span>In use elsewhere (<span id="suggestedInUseCount"></span>)</span>\
                        </h1>\
                        <div id="suggestedInUse">\
                          <ul class="inline separated">\
                          </ul>\
                        </div>\
                      </li>\
                      <li>\
                        <h1 class="propertyHeadline">\
                          <span style="display: inline-block !important;" class="ui-icon ui-icon-minus"></span>\
                          <span>General applicable (<span id="suggestedGeneralCount"></span>)</span>\
                        </h1>\
                        <div id="suggestedGeneral">\
                          <ul class="inline separated">\
                          </ul>\
                        </div>\
                      </li>\
                      <li>\
                        <h1 class="propertyHeadline">\
                          <span style="display: inline-block !important;" class="ui-icon ui-icon-plus"></span>\
                          <span>Applicable (<span id="suggestedApplicableCount"></span>)</span>\
                        </h1>\
                        <div id="suggestedApplicable">\
                        </div>\
                      </li>\
                    </ul>\
                 </div>\
                </div>';
        var modalwrapper = '<div class="modal-wrapper" style="display:none"></div>';
        if( $('#propertypicker').length == 0 ) {
            $('body').append(modalwrapper);
            $('.modal-wrapper').append(propertyPicker);
        }

        return markup;
    },

    submit: function () {
        if (this.shouldProcessSubmit()) {
            // get databank
            var databank   = RDFauthor.databankForGraph(this.statement.graphURI());
            var hasChanged = (
                this.statement.hasObject()
                && this.statement.objectValue() !== this.value()
                && null !== this.value()
            );

            if (hasChanged || this.removeOnSubmit) {
                var rdfqTriple = this.statement.asRdfQueryTriple();
                if (rdfqTriple) {
                    databank.remove(String(rdfqTriple));
                }
            }

            if (!this.removeOnSubmit && this.value()) {
                var self = this;
                try {
                    var newStatement = this.statement.copyWithObject({
                        value: '<' + this.value() + '>',
                        type: 'uri'
                    });
                    databank.add(newStatement.asRdfQueryTriple());
                } catch (e) {
                    var msg = e.message ? e.message : e;
                    alert('Could not save resource for the following reason: \n' + msg);
                    return false;
                }
            }
        }
        $('#propertypicker').remove();
        return true;
    },

    shouldProcessSubmit: function () {
        var t1 = !this.statement.hasObject();
        var t2 = null === this.value();
        var t3 = this.removeOnSubmit;

        return (!(t1 && t2) || t3);
    },

    value: function () {
        var typedValue = this.element().val();
        if (typedValue.length != 0) {
            return typedValue;
        }

        return null;
    },

    generateURI: function (item, prefix) {
        var lastChar = prefix.charAt(prefix.length - 1);
        if (!(lastChar == '/' || lastChar == '#')) {
            prefix += '/';
        }

        return prefix + item;
    },

    isURI: function (term) {
        // TODO: more advanced URI check
        return (/(https?:\/\/|mailto:|tel:)/.exec(term) !== null);
    },

    highlight: function (text, term) {
        var highlight = text.replace(RegExp(term, 'i'), '<em>$&</em>');
        return highlight;
    },

    localName: function (uri) {
        var s = String(uri);
        var l;
        if (s.lastIndexOf('#') > -1) {
            l = s.substr(s.lastIndexOf('#') + 1);
        } else {
            l = s.substr(s.lastIndexOf('/') + 1);
        }

        return (l !== '') ? l : s;
    },

    expandNamespace: function (prefixedName) {
        var splits = prefixedName.split(':', 2);
        if (splits.length >= 2) {
            if (splits[0] in this._namespaces) {
                return this._namespaces[splits[0]] + splits[1];
            }
        }

        return prefixedName;
    },

    _suggestions: function (callback) {
        var self = this;
        var subjectURI = self.statement.subjectURI();
        var graphURI = self.statement.graphURI();
        var prefixPattern = '\
            PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>\
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n';
        var selectPattern = 'DISTINCT ?resourceUri ?label\n';
        var typePattern = '<' + subjectURI + '> a ?class .\n';
        var classPattern = '?others a ?class .\n';
        var uriPattern = '?others ?resourceUri ?object .\n';
        var labelPattern = 'OPTIONAL {?resourceUri rdfs:label ?label . } .\n';
        var query = prefixPattern + 'SELECT ' + selectPattern 
                                  + 'WHERE { \n' 
                                  + typePattern
                                  + classPattern
                                  + uriPattern
                                  + labelPattern
                                  + '}';
        var propertiesInUse = {};
        // request properties in use
        RDFauthor.queryGraph(graphURI, query, {
            callbackSuccess: function(data) {
                var results = data.results.bindings;
                for (var i in results) {
                    if( (typeof(results[i].resourceUri) != "undefined")  && (i != "last") ) {
                        var resourceUri = results[i].resourceUri.value;
                        (typeof(results[i].label) != "undefined") && 
                        (results[i].label != null)              ? propertiesInUse[resourceUri] = results[i].label.value
                                                                : propertiesInUse[resourceUri] = null;
                    } 
                }
                self._hasProperties(function(hasProperties){
                    for (var resourceUri in propertiesInUse) {
                        $.inArray(resourceUri, hasProperties) != -1 ? delete propertiesInUse[resourceUri]
                                                                    : null;
                    }
                    $.isFunction(callback) ? callback(propertiesInUse) : null;
                })
            }
        });
    },

    _hasProperties: function (callback) {
        var self = this;
        var subjectURI = self.statement.subjectURI();
        var graphURI = self.statement.graphURI();
        var prefixPattern = '\
            PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>\
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n';
        var selectPattern = '?resourceUri\n';
        var uriPattern = '<' + subjectURI + '> ?resourceUri ?object .\n';
        var query = prefixPattern + 'SELECT ' + selectPattern 
                                  + 'WHERE { \n' 
                                  + uriPattern
                                  + '}';
        var hasProperties = [];
        //query
        RDFauthor.queryGraph(graphURI, query, {
            callbackSuccess: function(data) {
                var results = data.results.bindings;
                for (var i in results) {
                    if( (results[i].resourceUri != "undefined") && (i != "last") ) {
                        hasProperties.push(results[i].resourceUri.value);
                    }
                }
                $.isFunction(callback) ? callback(hasProperties) : null;
            },
            callbackError: function() {
                $.isFunction(callback) ? callback(hasProperties) : null;
            }
        });
    },

    _listProperty: function (resourceUri,label) {
        var self = this;
        label = label == null ? self.localName(resourceUri) : label;
        return '<li><a name="propertypicker" class="show-property Resource" about="'+resourceUri+'" \
                title="' + label + '">' + label + '</a></li>';
    },

    _normalizeValue: function (value) {
        if (!this.selectedResource) {
            this.selectedResource      = this.expandNamespace(value);
            this.selectedResourceLabel = this.localName(value);
        }
    },

    _init: function () {
        var self = this;
        var focus;
        if (this._pluginLoaded && this._domReady) {
            self.element().click(function() {
                console.log(RDFauthor.infoForPredicate('http://www.w3.org/1999/02/22-rdf-syntax-ns#type','comment'));
                focus = true;
                // positioning
                var left = self._getPosition().left + 'px !important;';
                var top = self._getPosition().top + 'px !important';
                self._positioning();

                $('#propertypicker').data('input',$(this))
                                    .draggable()
                                    .parent().fadeIn();
                // query - fills the everywhere in use part
                self._suggestions(function(propertiesInUse) {
                    // add in use everywhere to dom
                    $('#suggestedInUseCount').html(Object.size(propertiesInUse));
                    for (var resourceUri in propertiesInUse) {
                        $('#suggestedInUse ul').append(self._listProperty(resourceUri,propertiesInUse[resourceUri]));
                    }
                    // add general applicable to dom
                    $('#suggestedGeneralCount').html(Object.size(__propertycache['generalapplicable']));
                    for (var resourceUri in __propertycache['generalapplicable']) {
                        $('#suggestedGeneral ul').append(self._listProperty(resourceUri,__propertycache['generalapplicable'].label));
                    }
                });
            }).keydown(function (e) {
                if ((e.which === 13) && self._options.selectOnReturn) {
                    $('#propertypicker').hide();
                    var val = jQuery(e.target).val();
                    self._normalizeValue(val);

                    var splits = val.split(':', 2);
                    if (splits.length >= 2 && !self.isURI(val)) {
                        if (splits[0] in self._namespaces) {
                            self.selectedResource = self._namespaces[splits[0]] + splits[1];
                            self.selectedResourceLabel = splits[1];
                        }
                    }

                    self._options.selectionCallback(self.selectedResource, self.selectedResourceLabel);

                    // prevent newline in new widget field
                    e.preventDefault();
                } else if (e.which === 27) {
                    e.stopPropagation();
                }
            });

            /** SHOW-HIDE-SCROLL EVENTS */
            $('html').unbind('click').click(function(){
                if ($('#propertypicker').css("display") != "none" && focus == false) {
                    $('#propertypicker').parent().fadeOut();
                    self._reinitialization();
                }else if (focus == true){
                    $('#propertypicker').parent().fadeIn();
                }
            });
            $('#propertypicker,input[name="propertypicker"]').mouseover(function(){
                focus = true;
            });
            $('#propertypicker,input[name="propertypicker"]').mouseout(function(){
                focus = false;
            });

            $('.rdfauthor-view-content,html').scroll(function() {
                var left = self._getPosition().left + 'px !important;';
                var top = self._getPosition().top + 'px !important';
                    
                $('#propertypicker').css('left',left)
                                    .css('top',top);
                $('#propertypicker').parent().fadeOut();
            });

            $('#propertypicker .button-windowclose').live('click', function() {
                $('#propertypicker').parent().fadeOut();
                self._reinitialization();
            });

            /** TOGGLE EVENT */
            $('#propertypicker .content ul li').die('click').live('click', function(){
                $(this).find('h1 .ui-icon')
                       .hasClass('ui-icon-minus') ? $(this).find('h1 .ui-icon')
                                                           .removeClass('ui-icon-minus')
                                                           .addClass('ui-icon-plus')
                                                  : $(this).find('h1 .ui-icon')
                                                           .removeClass('ui-icon-plus')
                                                           .addClass('ui-icon-minus');
                $(this).find('div').eq(0).slideToggle();
            });
            
            /** CLICK EVENT ON PROPERTY */
            $('#propertypicker a[name="propertypicker"]').live('click', function(event){
                event.preventDefault();
                var resourceUri = $(this).attr('about');
                var keydownEvent = $.Event("keydown");
                keydownEvent.which=13;
                self.element().val(resourceUri).trigger(keydownEvent);
                $('.modal-wrapper').remove();
            })
        }
    },

    _getPosition: function () {
        var pos = {
            'top' : this.element().offset().top + this.element().outerHeight(),
            'left': this.element().offset().left
        };
        return pos;
    },

    _positioning: function () {
        var bodyh = $('body').height();
        var bodyw = $('body').width();
        //trick to get the height and width from a non visible object using jquery
        $(".modal-wrapper").show();
        var ww = $('#propertypicker').outerWidth();
        var wh = $('#propertypicker').outerHeight();
        $(".modal-wrapper").hide();
        var test = (bodyw - ww) * 0.5;
        console.log('aktuelle weite ' + test + ' bodyh ' + bodyh + ' bodyw ' + bodyw + ' wh ' + wh + ' ww ' + ww );
        var offsetPosition = {
            'top': 20,
            'left': Math.max( (bodyw - ww) * 0.5 , 50 )
        }
        $('#propertypicker').offset(offsetPosition);
    },

    _reinitialization: function () {
        var self = this;
        //remove tr row (propertyselector)
        self.element().parent().parent().parent().parent().parent().remove();
        //remove model-wrapper div including propertypicker
        $('#propertypicker').parent().remove();
    }

}, [{
        name: '__PROPERTY__'
    }]
);
