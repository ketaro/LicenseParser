# LicenseParser
Javascript AAMVA Driver License/Identification Card Parser for use with USB 2D Barcode Scanners

This script is a really basic parser that takes the encoded data from a PDF417 barcode and returns a hash of "normalized" data.

I searched the web for a library that does this, but everything I was finding was trying to do the image parsing.  There's none of that here.  This library assumes you're using a USB Barcode scanner capable of reading 2D codes.

Some higher-end scanners can parse out these codes and return them in the order you desire.  If you've got one of those fancy scanners, you don't need this library.  This is for scanners that don't do any of the parsing and just return the raw data from the barcode as if you typed it on a keyboard.

