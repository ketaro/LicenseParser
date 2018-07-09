
var axLicenseParserInject = {
    version: "0.9",
    port: chrome.runtime.connect(),

    ticket_ids: [],
    ticket_fields: {},
    
    scan_data: {},  // Results from scan

    statusDiv: null,
    console_field: document.getElementById( 'keycodes' ),
    
    init: function() {
        console.log("[LicenseParserExtension] Loading");
        
        // Inject our status display div
        this.addStatusDiv();

        // Initalize the license parser library and pass a callback function
        // to be called after a completed scan
        licenseParser.startCaptureCallback    = this.onCaptureStarted;
        licenseParser.doneCaptureCallback     = this.onCaptureDone;
        licenseParser.abortedCaptureCallback  = this.onCaptureFailed;
        licenseParser.log                     = this.logToConsoleField;
        
        licenseParser.init();
    },

    // Inject the status bar into the document
    addStatusDiv: function() {
        var div = document.createElement("div");
        div.id = "ax_licenseparser_status";
        div.className = "ax_licenseparser_status ax_licenseparser_hidden";
        div.innerHTML = "<h3>Scanning barcode, please wait...</h3>";
        
        document.body.appendChild(div);
        this.statusDiv = div;
    },
    
    status: function(text) {
        var hiddenClass = "ax_licenseparser_hidden";
        
        if (text) {
            this.statusDiv.innerHTML = "<h3>" + text + "</h3>";
            this.statusDiv.classList.remove(hiddenClass);
        } else {
            // Hide Status DIV
            this.statusDiv.classList.add(hiddenClass);
        }
    },
    
    
    // Return a field object based on a key from our internal
    // ticket_fields object
    getTicketField: function(ticket_id, key) {
        if (self.ticket_fields[ticket_id].hasOwnProperty(key)) {
            return document.getElementById(this.ticket_fields[ticket_id][key]);
        }
        return null;
    },
    

    // Called when capture is starting
    // (so we can display the status)
    onCaptureStarted: function() {
        self = axLicenseParserInject;
        self.status("Scanning Barcode, please wait...");
    },

    
    // Called when capture is complete
    // (close the status div and populate form data)
    onCaptureDone: function(data) {
        self = axLicenseParserInject;
        self.scan_data = data;

        self.status("Capture complete, setting fields...");

        // Detect ticket fields
        self.scanFields();
        
        // Set data in ticket fields
        if (self.ticket_ids.length == 1) {
            self.setFields( self.ticket_ids[0] );
        } else if (self.ticket_ids.length > 0) {
            
            // Find the first empty ticket to insert our data
            for (var i=0; i < self.ticket_ids.length; i++) {
                var ticket_id = self.ticket_ids[i];
                var field = self.getTicketField(ticket_id, "full_name");
                
                if (field && field.value == "") {
                    // Found one
                    self.setFields( self.ticket_ids[i] );
                    break;
                }
            }
        }
        
        self.status(false);
    },
    
    
    // Called if a capture fails
    onCaptureFailed: function() {
        self.status("Capture failed");
        
    },

    // Sets the fields for a given ticket_id with values from the last scan
    setFields: function( ticket_id ) {

        // SC Name -> License Parser data field
        var field_map = {
            'full_name':   'full_name',
            'address':     'address_1',
            'address2':    'address_2',
            'city':        'city',
            'state':       'state',
            'zip':         'postal_code',
            'country':     'country',
        };
        
        // Default country field to US
        var countryField = this.getTicketField(ticket_id, "country");
        countryField.value = 'US';
        
        // Fields in the address question we can easily map
        for (var key in field_map) {
            var value = field_map[key];
            var field = this.getTicketField(ticket_id, key);
            if (this.scan_data.hasOwnProperty(value))
                field.value = this.scan_data[value];
        }
        
        // Gender
        if (this.ticket_fields[ticket_id].hasOwnProperty("gender") &&
            this.scan_data.hasOwnProperty("gender")) {
            var genderField = this.getTicketField(ticket_id, "gender");
            if (genderField) {
                if (!isNaN(this.scan_data["gender"])) {
                    // numeric gender data; 1-male, 2-female
                    genderField.selectedIndex = this.scan_data["gender"];
                } else {
                    genderField.value = this.scan_data["gender"];
                }
            }
        }
        
        // Full Name
        document.getElementById('ticket_name_' + ticket_id).value = this.scan_data['full_name'];
        
        // DOB
        var dobField = this.getTicketField(ticket_id, "dob");
        if (dobField && this.scan_data.hasOwnProperty("dob")) {
            if ( this.scan_data["dob"] instanceof Date ) {
                var d = this.scan_data["dob"];
                var m = (d.getMonth()+1).toString().padStart(2, "0");
                
                dobField.value = m + '/' + d.getDate().toString().padStart(2, "0") + '/' + d.getFullYear();
            } else {
                dobField.value = this.scan_data["dob"];
            }
        }
        
    },


    // Logs debug data from the license parser
    logToConsoleField: function(txt) {
        self = axLicenseParserInject;
        
        if (self.console_field) {
            self.console_field.value += txt;
            self.console_field.scrollTop = self.console_field.scrollHeight;
        }
    },


    // Scan document and determine how many name/address fields 
    // we might be dealing with on the page.
    scanFields: function() {
        var inputs = document.querySelectorAll('input,select');
        
        this.ticket_ids = [];
        this.ticket_fields = [];
        
        for (var i=0; i < inputs.length; i++) {
            var thisField = inputs[i];
            
//             console.log("[LicenseParserExtension] found input field: " + thisField.name);
            
            var m = thisField.name.match(/answer\[Ticket\]\[(\d+)\]\[(\d+)\]\[(\w+)\]/);
            if (m) {
                var ticket_id = m[1];
                var field_id  = m[2];
                var field_name = m[3];
                
                if (!this.ticket_ids.includes(ticket_id)) {
                    this.ticket_ids.push(m[1]);
                    this.ticket_fields[ticket_id] = {};
                }
                
                this.ticket_fields[ticket_id][field_name] = thisField.id;
            } else {
                
                if (thisField.labels && thisField.labels.length > 0) {
                    if (thisField.labels[0].innerText.toLowerCase() == "gender")
                        this.ticket_fields[ticket_id]["gender"] = thisField.id;

                    if (thisField.labels[0].innerText.toLowerCase().includes("date of birth"))
                        this.ticket_fields[ticket_id]["dob"] = thisField.id;
                    
                }
            }
            
        }
        
        console.log(this.ticket_fields);
    },
    
    
};


axLicenseParserInject.init();

