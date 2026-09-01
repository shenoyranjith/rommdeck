@echo off
set APP_HOME=%~dp0..
java -Dfile.encoding=UTF-8 -cp "%APP_HOME%\lib\*" dev.rommdeck.syncd.MainKt %*
