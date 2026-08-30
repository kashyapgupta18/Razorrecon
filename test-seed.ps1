$maxTries = 10
$retryInterval = 3
$tries = 0
$success = $false

while (-not $success -and $tries -lt $maxTries) {
    try {
        $r = Invoke-WebRequest -Uri 'http://localhost:3000/api/seed' -Method POST -ErrorAction Stop
        Write-Output "Status: $($r.StatusCode)"
        Write-Output "Body: $($r.Content)"
        $success = $true
    } catch {
        Write-Output "Attempt $($tries+1) failed: $($_.Exception.Message)"
        if ($_.Exception.Response) {
            $errResponse = $_.Exception.Response
            $errStream = $errResponse.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($errStream)
            $reader.BaseStream.Position = 0
            Write-Output "Error Body: $($reader.ReadToEnd())"
        }
        $tries++
        Start-Sleep -Seconds $retryInterval
    }
}
