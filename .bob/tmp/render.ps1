param([int[]]$Pages, [int]$Width = 1200)
Get-Process WINWORD -ErrorAction SilentlyContinue | Stop-Process -Force
$root = (Resolve-Path "$PSScriptRoot").Path
$docx = Join-Path $root 'test-output.docx'
$pdf = Join-Path $root 'test-output.pdf'
$w = New-Object -ComObject Word.Application
$w.Visible = $false
$doc = $w.Documents.Open($docx, $false, $true)
$doc.ExportAsFixedFormat($pdf, 17)
$count = $doc.ComputeStatistics(2)
$doc.Close($false); $w.Quit()
"PageCount=$count"
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Data.Pdf.PdfDocument, Windows.Data.Pdf, ContentType = WindowsRuntime]
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.InMemoryRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime]
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
function Await($op, $type) { $t = $asTask.MakeGenericMethod($type).Invoke($null, @($op)); $t.Wait(-1) | Out-Null; $t.Result }
$file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($pdf)) ([Windows.Storage.StorageFile])
$pd = Await ([Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($file)) ([Windows.Data.Pdf.PdfDocument])
foreach ($i in $Pages) {
  $idx = if ($i -lt 0) { $pd.PageCount + $i } else { $i }
  $page = $pd.GetPage($idx)
  $ms = New-Object Windows.Storage.Streams.InMemoryRandomAccessStream
  $opts = New-Object Windows.Data.Pdf.PdfPageRenderOptions
  $opts.DestinationWidth = $Width
  $page.RenderToStreamAsync($ms, $opts).AsTask().Wait()
  $out = Join-Path $root ("pg$idx.png")
  $s = [IO.File]::Create($out)
  $ms.AsStreamForRead().CopyTo($s); $s.Close()
  "wrote $out"
}
