
Pod::Spec.new do |s|
  s.name         = "RNDocumentReaderBtdevice"
  s.version      = "1.0.0"
  s.summary      = "RNDocumentReaderBtdevice"
  s.description  = <<-DESC
                  RNDocumentReaderBtdevice
                   DESC
  s.homepage     = ""
  s.license      = "MIT"
  s.author             = { "author" => "author@domain.cn" }
  s.platform     = :ios, "11.0"
  s.source       = { :git => "https://github.com/author/RNDocumentReaderBtdevice.git", :tag => "master" }
  s.source_files  = "RNDocumentReaderBtdevice/**/*.{h,m}"
  s.requires_arc = true
  s.dependency "React"

end

  