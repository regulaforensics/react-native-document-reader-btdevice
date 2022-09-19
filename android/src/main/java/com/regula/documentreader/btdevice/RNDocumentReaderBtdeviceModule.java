
package com.regula.documentreader.btdevice;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;

public class RNDocumentReaderBtdeviceModule extends ReactContextBaseJavaModule {

  private final ReactApplicationContext reactContext;

  public RNDocumentReaderBtdeviceModule(ReactApplicationContext reactContext) {
    super(reactContext);
    this.reactContext = reactContext;
  }

  @Override
  public String getName() {
    return "RNDocumentReaderBtdevice";
  }
}