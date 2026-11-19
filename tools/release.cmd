@echo off
rem pot release wrapper: tools\release.cmd games\jimao --platform win64,android,webgl [--unity "D:\...\Unity.exe"] [--out dir]
node "%~dp0..\js\devserver\cli.js" release %*
