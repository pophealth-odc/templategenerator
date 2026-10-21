Add-Type -AssemblyName System.Runtime.WindowsRuntime
[void][Windows.Data.Pdf.PdfDocument,Windows.Data.Pdf,ContentType=WindowsRuntime]
[void][Windows.Storage.StorageFile,Windows.Storage,ContentType=WindowsRuntime]
[void][Windows.Storage.Streams.InMemoryRandomAccessStream,Windows.Storage.Streams,ContentType=WindowsRuntime]
function Await($wrtTask,$type){
  $mi=([System.WindowsRuntimeSystemExtensions].GetMethods()|?{$_.Name-eq'AsTask'-and$_.GetParameters().Count-eq1-and$_.GetParameters()[0].ParameterType.Name-eq'IAsyncOperation`1'})[0]
  $t=$mi.MakeGenericMethod($type).Invoke($null,@($wrtTask)); $t.GetAwaiter().GetResult()
}
$f=Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync('C:\Bob\templategenerator\.bob\tmp\test-output.pdf')) ([Windows.Storage.StorageFile])
$pd=Await ([Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($f)) ([Windows.Data.Pdf.PdfDocument])
foreach ($idx in 9,10,11){
  if($idx -ge $pd.PageCount){ continue }
  $pg=$pd.GetPage($idx)
  $ms=New-Object Windows.Storage.Streams.InMemoryRandomAccessStream
  $opt=New-Object Windows.Data.Pdf.PdfPageRenderOptions
  $opt.DestinationWidth=1400
  $renderOp=$pg.RenderToStreamAsync($ms,$opt)
  $mi2=([System.WindowsRuntimeSystemExtensions].GetMethods()|?{$_.Name-eq'AsTask'-and$_.GetParameters().Count-eq1-and$_.GetParameters()[0].ParameterType.Name-like'IAsyncAction*'})[0]
  if($mi2){$t2=$mi2.Invoke($null,@($renderOp));$t2.Wait()}else{
    $mi3=([System.WindowsRuntimeSystemExtensions].GetMethods()|?{$_.Name-eq'AsTask'-and$_.GetParameters().Count-eq1})|select -First 1
    $t2=$mi3.MakeGenericMethod([System.Object]).Invoke($null,@($renderOp));$t2.Wait()
  }
  $out='C:\Bob\templategenerator\.bob\tmp\pg'+$idx+'.png'
  $ext=[System.WindowsRuntimeSystemExtensions].GetMethod('AsStreamForRead',[System.Reflection.BindingFlags]'Public,Static',[System.Type[]].GetConstructor([Type[]]@()).Invoke($null))
  [System.IO.Stream]$st=$ms.AsStreamForRead()
  $fs=[IO.File]::Create($out); $st.CopyTo($fs); $fs.Close()
  Write-Host "wrote $out"
}
