$nodePath = "C:\Program Files\nodejs"
$env:PATH = "$nodePath;$env:PATH"
Set-Location "C:\me cago en mi madre\pedri-exporta-backend"
& "$nodePath\npm.cmd" install
Write-Host "Instalacion completada"
