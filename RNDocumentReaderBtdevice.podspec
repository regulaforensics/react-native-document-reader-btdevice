require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name         = "RNDocumentReaderBtdevice"
  s.version      = package['version']
  s.summary      = package['description']
  s.license      = package['license']

  s.authors      = { 'RegulaForensics' => 'support@regulaforensics.com' }
  s.homepage     = 'https://regulaforensics.com'

  s.source       = { :http => 'file:' + __dir__ }

  s.ios.deployment_target = '11.0'
  s.dependency 'BTDeviceBeta', '6.1.305'

  s.dependency 'React'
end
