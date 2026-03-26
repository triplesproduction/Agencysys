$baseUrl = "http://localhost:3000/api/v1"

$loginBody = @{
    employeeId = "admin-uuid-001"
    roleId = "ADMIN"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/auth/test-login" -Method POST -Headers @{ "Content-Type" = "application/json" } -Body $loginBody
    Write-Host "Success! Response:"
    $response | ConvertTo-Json
} catch {
    Write-Host "Failed! Error details:"
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $errBody = $reader.ReadToEnd()
    Write-Host $errBody
}
