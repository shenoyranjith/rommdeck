@echo off
setlocal
set APP_HOME=%~dp0..

if exist "%APP_HOME%\runtime\bin\java.exe" (
  set "JAVA_BIN=%APP_HOME%\runtime\bin\java.exe"
) else if defined ROMMDECK_JAVA (
  set "JAVA_BIN=%ROMMDECK_JAVA%"
) else if defined ROMMDECK_APP_ROOT if exist "%ROMMDECK_APP_ROOT%\lib\runtime\bin\java.exe" (
  set "JAVA_BIN=%ROMMDECK_APP_ROOT%\lib\runtime\bin\java.exe"
) else if defined JAVA_HOME if exist "%JAVA_HOME%\bin\java.exe" (
  set "JAVA_BIN=%JAVA_HOME%\bin\java.exe"
) else (
  set "JAVA_BIN=java"
)

"%JAVA_BIN%" -Dfile.encoding=UTF-8 -cp "%APP_HOME%\lib\*" dev.rommdeck.syncd.MainKt %*
