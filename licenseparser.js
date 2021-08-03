/*  License Parser v1.0
  
    Author: Nick Avgerinos - https://github.com/ketaro/LicenseParser
    
    Copyright (c) 2018 Axcella, LLC

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:
    
    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.
    
    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.
*/

var licenseParser = {
    version: "1.2",
 
    // Callbacks
    startCaptureCallback:   null,
    doneCaptureCallback:    null,
    abortedCaptureCallback: null,
    log: function(txt) {},      // Debug Log function

    keystack: [],
    data: {},
    header: {},
    subfile: {},

    capturing: false,
    entries: 0,
    capture_count: 0,

    // Mapping of Element IDs to common field names
    license_fields: {
        'DAA': 'full_name',
        'DAB': 'last_name',
        'DAC': 'first_name',
        'DAD': 'middle_name',
        'DAE': 'name_suffix',
        'DAF': 'name_prefix',
        'DAG': 'address_1',
        'DAH': 'address_2',
        'DAI': 'city',
        'DAJ': 'state',
        'DAK': 'postal_code',
        'DAL': 'address_1',
        'DAM': 'address_2',
        'DAN': 'city',
        'DAO': 'state',
        'DAP': 'postal_code',
        'DBB': 'dob',
        'DBC': 'gender',
        'DCG': 'country',
        'DCS': 'last_name',
        'DCT': 'first_name',
    },

    // Initalize the Library
    init: function() {
        console.log('[licenseParser] init');
        
        // Capture keypress events
        document.onkeypress = this.keypress_handler;
        document.onkeydown = this.key_handler;
    },
    
    // Returns an object containing just the data we care about from the keypress event
    keyobj: function( keyevent ) {
        return {
            key:      keyevent.key,
            keyCode:  keyevent.keyCode,
            charCode: keyevent.charCode,
            ctrlKey:  keyevent.ctrlKey,
            shiftKey: keyevent.shiftKey,
        }
    },

    // Push a key onto the stack
    stackpush: function( item ) {
        this.keystack.push( item );
        let stacksize = 10;
        if (this.capturing)
            stacksize = 256;
       
        // pull elements off until we're under our stack size limit
        while (this.keystack.length > stacksize)
            this.keystack.shift();
    },

    // Returns true if key is the Data Element Separator key (CTRL+SHIFT+J)
    isDES: function( key ) { return (
        key.key.toUpperCase() === "J" && key.ctrlKey //&& key.shiftKey
    ); },

    // Returns true if key is the Record Separator 
    isRS: function( key ) { return (key.keyCode === 30); },

    // Returns true if key is the Segment Terminator (CR/Enter)
    isST: function( key ) { return ( (key.keyCode === 13) || (key.keyCode === 10) ); },

    // Handle key up/down events, looking for CTRL+SHIFT+j
    // We need to trap it here so it doesn't open the downloads window
    // (Chrome on Windows)
    key_handler: function(e) {
        if (e.keyCode == "J".charCodeAt(0) && (e.shiftKey || e.ctrlKey)) {
            licenseParser.keypress_handler(e);
            return false; // stop processing this key
        }
    },

    // Event handler for when a key is pressed.
    keypress_handler: function(e) {
        e = e || window.event;
        let self = licenseParser;
        let key  = self.keyobj(e);

        // If we're in a password field, abort
        if (document.activeElement.type == 'password')
            return true;

        self.stackpush(key);

        // If we're capturing, don't output text
        if (self.capturing) {
            e.preventDefault();
            self.capture_count += 1;
        }
        
        // Handle special keys
        if (self.isDES(key))    // Data Element Separator
            self.on_des();
        else if (self.isRS(key))
            self.on_record_separator();
        else if (self.isST(key))
            self.on_segment_end();
        else if (self.capturing)
            self.log(key.key);
    },
    
    // Data Element Seperator found
    on_des: function() {
        this.log("\n");
        this.log("\n---[ Data Element Separator ]---\n");
        
        if (this.capturing) {
            if (this.header.filetype)
                this.process_data();
            else
                this.process_header();
            
            // Clear the buffer after we've processed the data element
            this.keystack = [];
        }

    },
    
    // As per the 2016 Card Design Standard,
    // There is no special case defined for when this field (record seperator) will be used. 
    // It is embodied within the recommendation for future growth.
    on_record_separator: function() {
        this.log("\n---[ Record Separator ]---\n");
    },
    
    // Received a Segment Terminator (CR/Enter)
    // If we're capturing, we've completed an entry
    // If we're not capturing, check if we should start
    on_segment_end: function() {
        this.log("\n---[ Segement Terminator ]--- (capture: " + this.capturing + ")\n");

        if ( this.capturing ) { // done with this segment
            this.entries += 1;
            
            // See if we've collected all the subfile entries
            if (this.entries >= this.header.entries)
                this.done_capture();
            
        } else {
            // Check if we should start capturing
            if (this.keystack.length < 3)   // Not enough data in the stack
                return;
            
            // If the last two characters we've seen are "@CTRL+J", start capturing
            let tail = this.keystack.slice(-3);
            if (tail[0].key === "@" && this.isDES(tail[1]))
                this.start_capture();
            else {
                // Or sometimes we get a FS keycode in there
                tail = this.keystack.slice(-4);
                if (tail[0].key === "@" && this.isDES(tail[1]) && tail[2].keyCode === 28)
                    this.start_capture();
            }
        }
    },
    
    start_capture: function() {
        this.capturing = true;
        this.entries = 0;
        this.capture_count = 0;
        this.data = {};
        this.header = {};

        this.keystack = [];
        this.log("\n---[ Start Capture ]---\n");

        // Call the registered callback
        if (this.startCaptureCallback)
            this.startCaptureCallback();
    },
    
    done_capture: function() {
        this.capturing = false;
        this.log("\n---[ Done Capture ]---\n");
        
        // On completed capture, the "@\n" that started the capture will have escaped
        // as type characters.  If there's an active field, see if we can remove them...
        var str = document.activeElement.value;
        if (str) {
            if (str.endsWith("@\n"))
                document.activeElement.value = str.substring(0, str.length-2)
            else if (str.endsWith("@")) // one-line input fields won't have the \n
                document.activeElement.value = str.substring(0, str.length-1)
        }
        
        // Full name parsing 
        if (this.data.full_name) {
            let parsedName = this.parseName(this.data.full_name);

            this.data.full_name = parsedName.fullName;

            if (!this.data.last_name)
                this.data.last_name = parsedName.lastName;
            if (!this.data.first_name)
                this.data.first_name = parsedName.firstName;
            if (!this.data.middle_name)
                this.data.middle_name = parsedName.middleName;
            if (!this.data.name_suffix)
                this.data.name_suffix = parsedName.suffix;
            if (!this.data.name_prefix)
                this.data.name_prefix = parsedName.salutation;
        } else {
            let name = [];
            if (this.data.first_name)
                name.push(this.data.first_name);
            if (this.data.middle_name)
                name.push(this.data.middle_name);
            if (this.data.last_name)
                name.push(this.data.last_name);
            if (this.data.name_suffix)
                name.push(this.data.name_suffix);

            this.data.full_name = name.join(" ");
        }
       
        // If first name contains a comma, it's probably FIRST,MIDDLE
        if (
            this.data.first_name &&
            this.data.first_name.includes(",") &&
            !this.data.middle_name
        ) {
            let name = this.data.first_name.split(",");
            this.data.first_name = name[0];
            this.data.middle_name = name[1];
        }

        if (this.data.country && this.data.country == "USA")
            this.data.country = "US";
        
        if (this.data.dob && this.data.dob.length == 8) {
            var dob_year  = this.data.dob.substr(0,4);
            var dob_month = this.data.dob.substr(4, 2);
            var dob_day   = this.data.dob.substr(6, 2);
            
            if (dob_year < 1900) {
                dob_month = this.data.dob.substr(0, 2);
                dob_day   = this.data.dob.substr(2, 2);
                dob_year  = this.data.dob.substr(4, 4);
            }
            
            this.data.dob = new Date( dob_year, dob_month-1, dob_day );
        }
        
        // Call the registered callback
        if (this.doneCaptureCallback)
            this.doneCaptureCallback(this.data);
    },
    
    abort_capture: function() {
        this.capturing = false;

        this.log("\n---[ Aborting Capture ]---\n");

        // Call the registered callback
        if (this.abortedCaptureCallback)
            this.abortedCaptureCallback();

    },
    
    // Returns a string of what is currently in the keystack
    stack_text: function() {
        var txt = "";

        for (var i=0; i < this.keystack.length; i++) {
            if ( this.keystack[i].ctrlKey ) // Ignore ctrl characters
                continue;
            
            txt += this.keystack[i].key;
        }

        return txt;
    },
    
    // When process_header is called, the keystack should contain the full header data
    process_header: function() {
        this.header = {};
        
        this.log("\n---[ Processing Header ]---\n");
        
        // Get the text accumulated in the stack so far
        var header_data = this.stack_text();
        
        var pos = 0;
        if (header_data.substr(0,5) === "ANSI ")
            pos = 5;
        else if (header_data.substr(0,6) === "AAMVA ")
            pos = 6;
        else if (header_data.substr(0,5) === "AAMVA")
            pos = 5;
        
        this.header.filetype = header_data.substr(0, pos).trim();

        if (pos < 1) {
            console.log("[licenseParser] Invalid file type: " + this.filetype);
            this.abort_capture();
            return;
        }
        
        this.header.iin           = header_data.substr(pos, 6);  pos += 6;
        this.header.aamva_version = header_data.substr(pos, 2);  pos += 2;
        this.header.js_version    = header_data.substr(pos, 2);  pos += 2;
        
        // The next field *should* be the number of different subfile types contained
        // in the barcode.  If it's not a number, it's probably the start of the subfile.
        this.header.entries       = parseInt(header_data.substr(pos, 2));
        if (isNaN(this.header.entries))
            this.header.entries = 1;  // Nope, keep position where it is, probably just 1 entry
        else
            pos += 2;  // Good, move the position forward
        
        this.log("Filetype: " + this.header.filetype + "\n");
        this.log("Entries: " + this.header.entries + "\n");
        
        // Remove header data from keystack, rest is subfile header data
        this.keystack = this.keystack.slice(pos);
        this.process_subfile_header();
        
        // If there's still data left, process it.
        this.process_data();
    },
    
    // Process a subfile header
    process_subfile_header: function() {
        this.subfile = {};
        
        var header_data = this.stack_text();
        var pos = 0;
        
        this.subfile.type = header_data.substr(pos, 2);  pos += 2;
        this.subfile.offset = parseInt(header_data.substr(pos, 4)); pos += 4;
        this.subfile.size   = parseInt(header_data.substr(pos, 4)); pos += 4;
        
        // Remove subfile header data from keystack
        this.keystack = this.keystack.slice(10);
    },
    
    // Process data in a subfile
    // data should be prefixed with a 3-character code which we'll lookup in our
    // license_fields for data we're interested in.
    process_data: function() {
        var data = this.stack_text();
        
        // First 3 characters are the element id
        var element_id = data.substr(0, 3);
        var value = data.substr(3);
        
        var data_key = this.license_fields[element_id];
        
        if (data_key)
            this.data[data_key] = value.trim();
    },

    // Parse a human name string into salutation, first name, middle name, last name, suffix.
    // https://github.com/chovy/humanparser
    parseName: function (name, ignoreSuffix) {
        if (!ignoreSuffix) ignoreSuffix = []
        const salutations = ['mr', 'master', 'mister', 'mrs', 'miss', 'ms', 'dr', 'prof', 'rev', 'fr', 'judge', 'honorable', 'hon', 'tuan', 'sr', 'srta', 'br', 'pr', 'mx', 'sra'];
        const suffixes = ['i', 'ii', 'iii', 'iv', 'v', 'senior', 'junior', 'jr', 'sr', 'phd', 'apr', 'rph', 'pe', 'md', 'ma', 'dmd', 'cme', 'qc', 'kc'].filter(suffix => !ignoreSuffix.includes(suffix));
        const compound = ['vere', 'von', 'van', 'de', 'del', 'della', 'der', 'den', 'di', 'da', 'pietro', 'vanden', 'du', 'st.', 'st', 'la', 'lo', 'ter', 'bin', 'ibn', 'te', 'ten', 'op', 'ben', 'al'];
    
        let parts = name
            .trim()
            .replace(/\b\s+(,\s+)\b/, '$1') // fix name , suffix -> name, suffix
            .replace(/\b,\b/, ', ')         // fix name,suffix -> name, suffix
        // look for quoted compound names
        parts = (parts.match(/[^\s"]+|"[^"]+"/g) || parts.split(/\s+/)).map(n => n.match(/^".*"$/) ? n.slice(1, -1) : n)
        const attrs = {};
    
        if (!parts.length) {
            return attrs;
        }
    
        if (parts.length === 1) {
            attrs.firstName = parts[0];
        }
    
        //handle suffix first always, remove trailing comma if there is one
        if (parts.length > 1 && suffixes.indexOf(parts[parts.length - 1].toLowerCase().replace(/\./g, '')) > -1) {
            attrs.suffix = parts.pop();
            parts[parts.length - 1] = parts[parts.length - 1].replace(',', '');
        }
    
        //look for a comma to know we have last name first format
        const firstNameFirstFormat = parts.every(part => {
            return part.indexOf(',') === -1;
        });
    
        if (!firstNameFirstFormat) {
            //last name first format
            //assuming salutations are never used in this format
    
            //tracker variable for where first name begins in parts array
            let firstNameIndex;
    
            //location of first comma will separate last name from rest
            //join all parts leading to first comma as last name
            const lastName = parts.reduce((lastName, current, index) => {
                if (!Array.isArray(lastName)) {
                    return lastName;
                }
                if (current.indexOf(',') === -1) {
                    lastName.push(current);
                    return lastName;
                } else {
                    current = current.replace(',', '');
    
                    // handle case where suffix is included in part of last name (ie: 'Hearst Jr., Willian Randolph')
                    if (suffixes.indexOf(current.toLowerCase().replace(/\./g, '')) > -1) {
                        attrs.suffix = current;
                    } else {
                        lastName.push(current);
                    }
    
                    firstNameIndex = index + 1;
                    return lastName.join(' ');
                }
            }, []);
    
            attrs.lastName = lastName;
    
            var remainingParts = parts.slice(firstNameIndex);
            if (remainingParts.length > 1) {
                attrs.firstName = remainingParts.shift();
                attrs.middleName = remainingParts.join(' ');
            } else if (remainingParts.length) {
                attrs.firstName = remainingParts[0];
            }
    
            //create full name from attrs object
            const nameWords = [];
            if (attrs.firstName) {
                nameWords.push(attrs.firstName);
            }
            if (attrs.middleName) {
                nameWords.push(attrs.middleName)
            }
            nameWords.push(attrs.lastName)
            if (attrs.suffix) {
                nameWords.push(attrs.suffix);
            }
            attrs.fullName = nameWords.join(' ');
    
    
        } else {
            //first name first format
    
    
            if (parts.length > 1 && salutations.indexOf(parts[0].toLowerCase().replace(/\./g, '')) > -1) {
                attrs.salutation = parts.shift();
    
                // if we have a salutation assume 2nd part is last name
                if (parts.length === 1) {
                    attrs.lastName = parts.shift();
                } else {
                    attrs.firstName = parts.shift();
                }
            } else {
                attrs.firstName = parts.shift();
            }
    
            if (!attrs.lastName) {
                attrs.lastName = parts.length ? parts.pop() : '';
            }
    
            // test for compound last name, we reverse because middle name is last bit to be defined.
            // We already know lastname, so check next word if its part of a compound last name.
            const revParts = parts.slice(0).reverse();
            const compoundParts = [];
    
            revParts.every(part => {
                const test = part.toLowerCase().replace(/\./g, '');
    
                if (compound.indexOf(test) > -1) {
                    compoundParts.push(part);
    
                    return true;
                }
    
                //break on first non compound word
                return false;
            });
    
            //join compound parts with known last name
            if (compoundParts.length) {
                attrs.lastName = compoundParts.reverse().join(' ') + ' ' + attrs.lastName;
    
                parts = diff(parts, compoundParts);
            }
    
            if (parts.length) {
                attrs.middleName = parts.join(' ');
            }
    
            //remove comma like "<lastName>, Jr."
            if (attrs.lastName) {
                attrs.lastName = attrs.lastName.replace(',', '');
            }
    
            //save a copy of original
            attrs.fullName = name;
    
        }
        //console.log('attrs:', JSON.stringify(attrs));
    
        for (const [k, v] of Object.entries(attrs)) {
            attrs[k] = v.trim()
        }
        return attrs;
    }

}
