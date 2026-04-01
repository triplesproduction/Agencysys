$baseUrl = "http://localhost:3000/api/v1"
$reportFile = "functional_test_report.md"
$report = "# Phase 1.1 Functional UI Verification Report`n`n"
Write-Host "Starting Phase 1.1 Functional Tests..."

function Run-Test {
    param([string]$Name, [scriptblock]$Action)
    try {
        $result = &$Action
        $script:report += "### [X] $Name`n- **Status**: SUCCESS`n- **Details**: $result`n`n"
        Write-Host "[X] $Name - SUCCESS"
    } catch {
        $msg = $_.Exception.Message
        if ($_.Exception.Response) {
            $errResp = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($errResp)
            $msg += " | Body: " + $reader.ReadToEnd()
        }
        $script:report += "### [ ] $Name`n- **Status**: FAILED`n- **Error**: $msg`n`n"
        Write-Host "[ ] $Name - FAILED"
        Write-Host "Error: $msg" -ForegroundColor Red
    }
}

# 1. Login (Admin)
$adminToken = ""
Run-Test -Name "1. Login Flow (Admin)" -Action {
    $body = @{ employeeId = "admin-user-01"; roleId = "ADMIN"; email = "admin@triples.com"; password = "pass" } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/auth/test-login" -Method Post -Body $body -ContentType "application/json"
    if (-not $res.access_token) { throw "No access token received" }
    $script:adminToken = $res.access_token
    return "Admin Token received successfully."
}

# 2. Create Employee
$newEmpId = ""
Run-Test -Name "2. Create Employee Flow" -Action {
    $rand = Get-Random -Maximum 99999
    $body = @{
        firstName = "John"
        lastName = "Doe"
        email = "john.doe$rand@triples.com"
        roleId = "EMPLOYEE"
        department = "Engineering"
    } | ConvertTo-Json
    $headers = @{ Authorization = "Bearer $adminToken" }
    $res = Invoke-RestMethod -Uri "$baseUrl/employees" -Method Post -Body $body -Headers $headers -ContentType "application/json"
    $script:newEmpId = $res.id
    if (-not $newEmpId) { throw "No employee ID returned" }
    return "Employee Created ID: $($res.id)"
}

# 3. Login (New Employee)
$empToken = ""
Run-Test -Name "3. Login Flow (New Employee)" -Action {
    $body = @{ employeeId = $newEmpId; roleId = "EMPLOYEE" } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/auth/test-login" -Method Post -Body $body -ContentType "application/json"
    $script:empToken = $res.access_token
    if (-not $empToken) { throw "No access token received for employee" }
    return "Employee Token received successfully."
}

# 4. Create Task
$taskId = ""
Run-Test -Name "4. Task Creation Flow" -Action {
    $body = @{
        title = "Develop Feature X"
        description = "Implement new dashboard"
        assigneeId = $newEmpId
        priority = "HIGH"
        dueDate = (Get-Date).AddDays(5).ToString("yyyy-MM-ddTHH:mm:ssZ")
        estimatedHours = 10
    } | ConvertTo-Json
    $headers = @{ Authorization = "Bearer $empToken" }
    $res = Invoke-RestMethod -Uri "$baseUrl/tasks" -Method Post -Body $body -Headers $headers -ContentType "application/json"
    $script:taskId = $res.id
    if (-not $taskId) { throw "Task creation failed" }
    return "Task Created ID: $($res.id)"
}

# 5. Leave Apply
Run-Test -Name "5. Leave Apply Flow" -Action {
    $body = @{
        leaveType = "CASUAL"
        startDate = (Get-Date).AddDays(10).ToString("yyyy-MM-dd")
        endDate = (Get-Date).AddDays(12).ToString("yyyy-MM-dd")
        reason = "Personal trip"
    } | ConvertTo-Json
    $headers = @{ Authorization = "Bearer $empToken" }
    $res = Invoke-RestMethod -Uri "$baseUrl/leaves" -Method Post -Body $body -Headers $headers -ContentType "application/json"
    return "Leave Applied ID: $($res.id)"
}

# 6. EOD Submit
Run-Test -Name "6. EOD Submit Flow" -Action {
    $body = @{
        reportDate = (Get-Date).ToString("yyyy-MM-dd")
        tasksCompleted = @()
        tasksInProgress = @($taskId)
        blockers = "None"
        sentiment = "GOOD"
    } | ConvertTo-Json
    $headers = @{ Authorization = "Bearer $empToken" }
    $res = Invoke-RestMethod -Uri "$baseUrl/eod-reports" -Method Post -Body $body -Headers $headers -ContentType "application/json"
    return "EOD Submitted ID: $($res.id)"
}

# 7. KPI Fetch
Run-Test -Name "7. KPI Fetch Flow" -Action {
    $headers = @{ Authorization = "Bearer $empToken" }
    $res = Invoke-RestMethod -Uri "$baseUrl/kpis/employees/$newEmpId" -Method Get -Headers $headers
    return "KPIs fetched successfully. Count: $($res.Count)"
}

$report | Out-File -FilePath $reportFile -Encoding utf8
Write-Host "Functional Tests completed. Output saved to $reportFile"
