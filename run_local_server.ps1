# run_local_server.ps1
# Starts a local web server on http://localhost:8080 using .NET HttpListener.
# This prevents CORS errors when using Babel Standalone to compile local files in the browser.

$port = 8080
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")

try {
    $listener.Start()
    Write-Host ""
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "  🚀 LOCAL PORTAL SERVER RUNNING" -ForegroundColor Green
    Write-Host "  Address: http://localhost:$port/" -ForegroundColor Green
    Write-Host "  MIME Types configured for HTML, CSS, JS, and JSX files." -ForegroundColor Cyan
    Write-Host "  Press [Ctrl + C] in this window to stop the server." -ForegroundColor Yellow
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host ""

    # Open the browser automatically to the running site
    Start-Process "http://localhost:$port/"

    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $path = $request.Url.LocalPath
        if ($path -eq "/" -or $path -eq "") { 
            $path = "/index.html" 
        }
        
        # Clean query strings and resolve relative paths
        $cleanPath = $path.Split('?')[0]
        $filePath = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot $cleanPath))
        
        # Security check: Ensure requested file is inside project root
        if (-not $filePath.StartsWith($PSScriptRoot)) {
            $response.StatusCode = 403
            $response.Close()
            continue
        }

        if (Test-Path $filePath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            
            # Content Type Mapping
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $contentType = "text/plain"
            switch ($ext) {
                ".html" { $contentType = "text/html; charset=utf-8" }
                ".css" { $contentType = "text/css; charset=utf-8" }
                ".js"  { $contentType = "application/javascript; charset=utf-8" }
                ".jsx" { $contentType = "application/javascript; charset=utf-8" }
                ".json" { $contentType = "application/json; charset=utf-8" }
                ".ico"  { $contentType = "image/x-icon" }
            }
            
            $response.ContentType = $contentType
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            # File Not Found
            $response.StatusCode = 404
            $errBytes = [System.Text.Encoding]::UTF8.GetBytes("404 File Not Found: $path")
            $response.ContentLength64 = $errBytes.Length
            $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
        }
        $response.Close()
    }
} catch {
    Write-Host "Server encountered an error or was stopped: $_" -ForegroundColor Red
} finally {
    if ($listener.IsListening) {
        $listener.Stop()
    }
}
