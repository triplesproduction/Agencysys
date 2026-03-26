$baseUrl = "http://localhost:3000/api/v1"

function Write-Test {
    param([string]$name)
    Write-Host "`n--- Testing: $name ---" -ForegroundColor Cyan
}

function Invoke-Api {
    param(
        [string]$Method,
        [string]$Endpoint,
        [string]$Body = $null,
        [string]$Token = $null
    )
    
    $headers = @{}
    $headers.Add("Content-Type", "application/json")
    if ($Token) {
        $headers.Add("Authorization", "Bearer $Token")
    }
    
    $uri = "$baseUrl$Endpoint"
    
    try {
        if ($Body) {
            $response = Invoke-RestMethod -Uri $uri -Method $Method -Headers $headers -Body $Body
        } else {
            $response = Invoke-RestMethod -Uri $uri -Method $Method -Headers $headers
        }
        
        return @{
            Status = 200 # Defaulting to OK for Invoke-RestMethod success
            Data = $response
        }
    } catch {
        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $errBody = $reader.ReadToEnd()
            $errObj = $errBody | ConvertFrom-Json
            return @{ Status = $statusCode; Data = $errObj }
        } else {
            Write-Host "Fatal Error connecting to $uri : $_" -ForegroundColor Red
            return @{ Status = 0; Data = $_.Exception.Message }
        }
    }
}

Write-Test "Health Check"
$res = Invoke-Api -Method "GET" -Endpoint "/health"
Write-Host "Status: $($res.Status) | $(if ($res.Status -eq 200) { 'PASS' } else { 'FAIL' })"

Write-Test "Generate Admin Token"
$loginBody = @{
    employeeId = "admin-uuid-001"
    roleId = "ADMIN"
} | ConvertTo-Json

$loginRes = Invoke-Api -Method "POST" -Endpoint "/auth/test-login" -Body $loginBody
$adminToken = $loginRes.Data.access_token
Write-Host "Admin Token Retrieved: $(if ($adminToken) { 'PASS' } else { 'FAIL' })"

Write-Test "Generate Employee Token"
$empLoginBody = @{
    employeeId = "worker-uuid-002"
    roleId = "EMPLOYEE"
} | ConvertTo-Json

$empLoginRes = Invoke-Api -Method "POST" -Endpoint "/auth/test-login" -Body $empLoginBody
$empToken = $empLoginRes.Data.access_token
Write-Host "Employee Token Retrieved: $(if ($empToken) { 'PASS' } else { 'FAIL' })"

Write-Test "RBAC Guard Validation - Admin Access"
$rbacRes = Invoke-Api -Method "GET" -Endpoint "/auth/test-rbac" -Token $adminToken
Write-Host "Status: $($rbacRes.Status) (Expected 200) | $(if ($rbacRes.Status -eq 200) { 'PASS' } else { 'FAIL' })"

Write-Test "RBAC Guard Validation - Employee Access (Should Fail)"
$rbacFailRes = Invoke-Api -Method "GET" -Endpoint "/auth/test-rbac" -Token $empToken
Write-Host "Status: $($rbacFailRes.Status) (Expected 403) | $(if ($rbacFailRes.Status -eq 403) { 'PASS' } else { 'FAIL' })"

Write-Test "Employee Module CRUD - List"
$empRes = Invoke-Api -Method "GET" -Endpoint "/employees" -Token $adminToken
Write-Host "Status: $($empRes.Status) | Items: $($empRes.Data.Count)"

Write-Test "Task Module - Validation Trigger (Missing Fields)"
$taskFailBody = @{
    title = "Incomplete Task"
} | ConvertTo-Json
$taskFailRes = Invoke-Api -Method "POST" -Endpoint "/tasks" -Body $taskFailBody -Token $adminToken
Write-Host "Status: $($taskFailRes.Status) (Expected 400) | Validation: $($taskFailRes.Data.message -join ', ')"

Write-Test "Task Module - Create"
$validTaskBody = @{
    title = "Test Task via API"
    assigneeId = "worker-uuid-002"
    creatorId = "admin-uuid-001"
    status = "TODO"
    priority = "HIGH"
    dueDate = (Get-Date).AddDays(2).ToString("yyyy-MM-ddTHH:mm:ssZ")
} | ConvertTo-Json
$taskRes = Invoke-Api -Method "POST" -Endpoint "/tasks" -Body $validTaskBody -Token $adminToken
$taskId = $taskRes.Data.id
Write-Host "Status: $($taskRes.Status) | Task ID: $taskId"

if ($taskId) {
    Write-Test "Task Module - Status Transition"
    $taskUpdateBody = @{
        status = "IN_PROGRESS"
    } | ConvertTo-Json
    $taskUpdRes = Invoke-Api -Method "PATCH" -Endpoint "/tasks/$taskId/status" -Body $taskUpdateBody -Token $adminToken
    Write-Host "Status: $($taskUpdRes.Status) | New Status: $($taskUpdRes.Data.status)"
}

Write-Test "EOD Submission"
$eodBody = @{
    reportDate = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssZ")
    tasksCompleted = @()
    tasksInProgress = @(if ($taskId) { $taskId } else { "dummy" })
    sentiment = "GOOD"
} | ConvertTo-Json
$eodRes = Invoke-Api -Method "POST" -Endpoint "/eod-reports" -Body $eodBody -Token $empToken
if ($eodRes.Status -eq 200 -or $eodRes.Status -eq 201) {
    Write-Host "Status: $($eodRes.Status) | EOD ID: $($eodRes.Data.id)"
} else {
    Write-Host "Status: $($eodRes.Status) | Error: $($eodRes.Data | ConvertTo-Json -Depth 2)"
}

Write-Test "WorkHour Logging"
$whBody = @{
    date = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssZ")
    hoursLogged = 2.5
    taskId = $taskId
} | ConvertTo-Json -Depth 2
$whRes = Invoke-Api -Method "POST" -Endpoint "/work-hours" -Body $whBody -Token $empToken
if ($whRes.Status -eq 200 -or $whRes.Status -eq 201) {
    Write-Host "Status: $($whRes.Status) | Log ID: $($whRes.Data.id)"
} else {
    Write-Host "Status: $($whRes.Status) | Error: $($whRes.Data | ConvertTo-Json -Depth 2)"
}

Write-Test "Leave Application"
$leaveBody = @{
    leaveType = "SICK"
    startDate = (Get-Date).AddDays(1).ToString("yyyy-MM-ddTHH:mm:ssZ")
    endDate = (Get-Date).AddDays(2).ToString("yyyy-MM-ddTHH:mm:ssZ")
    reason = "Feeling unwell"
} | ConvertTo-Json
$leaveRes = Invoke-Api -Method "POST" -Endpoint "/leaves" -Body $leaveBody -Token $empToken
if ($leaveRes.Status -eq 200 -or $leaveRes.Status -eq 201) {
    $leaveId = $leaveRes.Data.id
    Write-Host "Status: $($leaveRes.Status) | Leave ID: $leaveId"
} else {
    Write-Host "Status: $($leaveRes.Status) | Error: $($leaveRes.Data | ConvertTo-Json -Depth 2)"
}

if ($leaveId) {
    Write-Test "Leave Transition (Approval via Admin)"
    $leaveUpdBody = @{
        status = "APPROVED"
    } | ConvertTo-Json
    $leaveUpdRes = Invoke-Api -Method "PATCH" -Endpoint "/leaves/$leaveId/status" -Body $leaveUpdBody -Token $adminToken
    Write-Host "Status: $($leaveUpdRes.Status) | New Status: $($leaveUpdRes.Data.status)"
}

Write-Test "KPI calculation trigger"
$kpiRes = Invoke-Api -Method "POST" -Endpoint "/kpis/trigger" -Token $adminToken
Write-Host "Status: $($kpiRes.Status) | Message: $($kpiRes.Data.message)"

Write-Host "`n--- API Testing Completed ---" -ForegroundColor Green
