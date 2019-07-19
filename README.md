# LicenseParser
### Javascript AAMVA Driver License/Identification Card Parser for use with USB 2D Barcode Scanners

This script is a really basic parser that takes the encoded data from a PDF417 barcode and returns a hash of "normalized" data.

I searched the web for a library that does this, but everything I was finding was trying to do the image parsing.  There's none of that here.  This library assumes you're using a USB Barcode scanner capable of reading 2D codes.

Some higher-end scanners can parse out these codes and return them in the order you desire.  If you've got one of those fancy scanners, you don't need this library.  This is for scanners that don't do any of the parsing and just return the raw data from the barcode as if you typed it on a keyboard.

This is just something I threw together in one night to test if I could do it.  It's not all that robust in terms of error checking, header validation and what not.  I've only been able to test against a small handful of license samples from DMV's kind enough to post samples online.

*THIS IS NOT PRODUCTION READY CODE!!*  It's a nice start, but use at your own risk!

How to use:
```javascript
<script type="text/javascript" src="licenseparser.js"></script>
<script type="text/javascript">

  function onParsedData(data) {
      document.getElementById('firstname').value  = data['first_name'] || "";
      document.getElementById('middlename').value = data['middle_name'] || "";
      document.getElementById('lastname').value   = data['last_name'] || "";
  }

  // Initalize the license parser library and pass a callback function
  // to be called after a completed scan
  licenseParser.init(onParsedData);

</script>
```

## Build .crx

zip -r LicenseParser.zip *
crx3-new LicenseParser.pem < LicenseParser.zip > LicenseParser.crx


References:
* https://www.aamva.org/DL-ID-Card-Design-Standard/
