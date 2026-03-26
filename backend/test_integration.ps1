$baseUrl = "http://localhost:3000/api/v1"
$report = "# Phase 1 Integration Test Report`n`n"

Write-Host "Starting Integration Tests..."

# Test 1: Health / Reachability
$sw = [Diagnostics.Stopwatch]::StartNew()
try {
    $res = Invoke-RestMethod -Uri "$baseUrl/health" -Method Get -ErrorAction Stop
    $sw.Stop()
    $report += "## 1. Backend Reachability & Latency`n"
    $report += "- **Status**: SUCCESS`n"
    $report += "- **Latency**: $($sw.ElapsedMilliseconds) ms`n"
    $report += "- **Details**: Backend is reachable and responding.`n`n"
} catch {
    $sw.Stop()
    $report += "## 1. Backend Reachability & Latency`n"
    $report += "- **Status**: FAILED`n"
    $report += "- **Details**: $($_.Exception.Message)`n`n"
}

# Test 2: JWT Auth Header (Unauthorized Request)
try {
    $res = Invoke-RestMethod -Uri "$baseUrl/eod-reports/me" -Method Get -ErrorAction Stop
    $report += "## 2. JWT Auth Enforcement`n"
    $report += "- **Status**: FAILED (Expected 401, got 200)`n`n"
} catch {
    $httpStatus = $_.Exception.Response.StatusCode.value__
    if ($httpStatus -eq 401 -or $httpStatus -eq 403) {
        $report += "## 2. JWT Auth Enforcement`n"
        $report += "- **Status**: SUCCESS`n"
        $report += "- **Details**: Properly blocked unauthorized request with HTTP $httpStatus.`n`n"
    } else {
        $report += "## 2. JWT Auth Enforcement`n"
        $report += "- **Status**: FAILED`n"
        $report += "- **Details**: Expected 401/403, got $httpStatus.`n`n"
    }
}

# Output report locally
$report | Out-File -FilePath "integration_report.md" -Encoding utf8
Write-Host "Tests completed. Report saved."
