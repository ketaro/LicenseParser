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
    version: "1.0",
    
    callback: null,
    
    keystack: [],
    data: {},
    header: {},
    subfile: {},
    
    capturing: false,
    entries: 0,
    capture_count: 0,
    
    console: document.getElementById( 'keycodes' ),
    
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
        'DCS': 'last_name',
        'DCT': 'first_name',
    },
    
    // Initalize the Library
    init: function(callback) {
        // Store our callback function
        this.callback = callback;
        
        // Capture keypress events
        document.onkeypress = this.keypress_handler;
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
        
        while (this.keystack.length > 100)
            this.keystack.shift();
            
    },
    
    // Returns true if key is the Data Element Separator key (CTRL+SHIFT+J)
    isDES: function( key ) { return (key.key === "J" && key.ctrlKey && key.shiftKey); },
    
    // Returns true if key is the Record Separator 
    isRS: function( key ) { return (key.keyCode == 30); },
    
    // Returns true if key is the Segment Terminator (CR/Enter)
    isST: function( key ) { return ( key.keyCode == 13 ); },
    
    // Event handler for when a key is pressed.
    keypress_handler: function(e) {
        e = e || window.event;
        var self = licenseParser;
        var key  = self.keyobj(e);

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
        else
            self.console.value += key.key;
    },
    
    // Data Element Seperator found
    on_des: function() {
        this.console.value += "\n---[ Data Element Separator ]---\n";
        
        if (this.capturing) {
            if (this.header.filetype)
                this.process_data();
            else
                this.process_header();
            
            // Clear the buffer after we've processed the data element
            this.keystack = [];
        }

    },
    
    on_record_separator: function() {
        this.console.value += "\n---[ Record Separator ]---\n";
        
    },
    
    on_segment_end: function() {
        this.console.value += "\n---[ Segement Terminator ]--- (capture: " + this.capturing + ")\n";
        
        if ( this.capturing ) { // done with this segment
            this.entries += 1;
            
            // See if we've collected all the subfile entries
            if (this.entries >= this.header.entries)
                this.done_capture();
            
        } else {
            // Check if we should start capturing
            if (this.keystack.length < 3)   // Not enough data in the stack
                return;
            
            // If the last two characters we've seen are "@\n", start capturing
            var tail = this.keystack.slice(-3);
            if ( tail[0].key === "@" && this.isDES(tail[1]) )
                this.start_capture();
        }
    },
    
    start_capture: function() {
        this.capturing = true;
        this.entries = 0;
        this.capture_count = 0;
        this.data = {};
        this.header = {};

        this.keystack = [];
        this.console.value += "\n---[ Start Capture ]---\n";
    },
    
    done_capture: function() {
        this.capturing = false;
        this.console.value += "\n---[ Done Capture ]---\n";
        
        // On completed capture, the "@\n" that started the capture will have escaped
        // as type characters.  If there's an active field, see if we can remove them...
        var str = document.activeElement.value;
        if (str) {
            if (str.endsWith("@\n"))
                document.activeElement.value = str.substring(0, str.length-2)
            else if (str.endsWith("@")) // one-line input fields won't have the \n
                document.activeElement.value = str.substring(0, str.length-1)
        }
        
        // Convoluted full name parsing 
        if (this.data.full_name) {
            var name = this.data.full_name.split(",");
            var ln = name[0];
            var fn = "";
            var mn = "";
            if (name.length > 1) {
                name = name[1].trim().split(" ")
                fn = name.slice(0, -1).join(" ");
                mn = name.slice(-1).join(" ");
            }
            
            if (!this.data.last_name)
                this.data.last_name = ln;
            if (!this.data.first_name)
                this.data.first_name = fn;
            if (!this.data.middle_name)
                this.data.middle_name = mn;
        }
        
        // Call the registered callback
        if (this.callback)
            this.callback(this.data);
    },
    
    abort_capture: function() {
        this.capturing = false;

        this.console.value += "\n---[ Aborting Capture ]---\n";
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
        
        this.console.value += "\n---[ Processing Header ]---\n";
        
        // Get the text accumulated in the stack so far
        var header_data = this.stack_text();
        
        var pos = 0;
        if (header_data.substr(0,5) === "ANSI ")
            pos = 5;
        if (header_data.substr(0,6) === "AAMVA ")
            pos = 6;
        
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
        
        // Remove header data from keystack, rest is subfile header data
        this.keystack = this.keystack.slice(pos);
        this.process_subfile_header();

    },
    
    // Process a subfile header
    process_subfile_header: function() {
        this.subfile = {};
        
        var header_data = this.stack_text();
        var pos = 0;
        
        this.subfile.type = header_data.substr(pos, 2);  pos += 2;
        this.subfile.offset = parseInt(header_data.substr(pos, 4)); pos += 4;
        this.subfile.size   = parseInt(header_data.substr(pos, 4)); pos += 4;
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
    
}
