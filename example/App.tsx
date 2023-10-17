
import React from 'react'
import { SafeAreaView, ScrollView, StyleSheet, Text, View, NativeEventEmitter, Image, Button, TextInput } from 'react-native'
import DocumentReader, { Enum, DocumentReaderCompletion, DocumentReaderScenario, RNRegulaDocumentReader, DocumentReaderResults, ScannerConfig, RecognizeConfig } from '@regulaforensics/react-native-document-reader-api-beta'
import RadioGroup from 'react-native-radio-buttons-group'
import { CheckBox } from '@rneui/themed'
import Icon from 'react-native-vector-icons/FontAwesome'
import { launchImageLibrary } from 'react-native-image-picker'

var isReadingRfid = false

interface IProps {
}

interface IState {
  btDeviceName: string,
  isBleServiceConnected: boolean,
  isBleDeviceReady: boolean,
  fullName: string | undefined
  doRfid: boolean
  canRfid: boolean
  canRfidTitle: string
  radioButtons: any
  selectedScenario: string
  portrait: any
  docFront: any
}

export default class App extends React.Component<IProps, IState> {
  constructor(props: {} | Readonly<{}>) {
    super(props)
    Icon.loadFont()

    var eventManager = new NativeEventEmitter(RNRegulaDocumentReader)
    eventManager.addListener('prepareDatabaseProgressChangeEvent', e => this.setState({ fullName: "Downloading database: " + e["msg"] + "%" }))
    eventManager.addListener('completionEvent', (e) => this.handleCompletion(DocumentReaderCompletion.fromJson(JSON.parse(e["msg"]))!))

    eventManager.addListener('bleOnServiceConnectedEvent', (_) => this.bleOnServiceConnected())
    eventManager.addListener('bleOnServiceDisconnectedEvent', (_) => this.bleOnServiceDisconnected())
    eventManager.addListener('bleOnDeviceReadyEvent', (_) => this.bleOnDeviceReady())

    DocumentReader.prepareDatabase("FullAuth", (respond) => {
      console.log(respond)
      this.setState({ fullName: "Database prepared" })
    }, error => console.log(error))

    this.state = {
      btDeviceName: "Regula 0000",
      isBleServiceConnected: false,
      isBleDeviceReady: false,
      fullName: "Please wait...",
      doRfid: false,
      canRfid: false,
      canRfidTitle: "(unavailable)",
      radioButtons: [{ label: 'Loading', id: "0" }],
      selectedScenario: "",
      portrait: require('./images/portrait.png'),
      docFront: require('./images/id.png')
    }
  }

  bleOnServiceConnected() {
    console.log("bleService connected, searching devices")

    this.setState({ isBleServiceConnected: true })

    setTimeout(() => {
      if (!this.state.isBleDeviceReady) {
        console.log("Failed to connect to the torch device")
        this.setState({ fullName: "Failed to connect to the torch device" })
      }
    }, 7000)
  }

  bleOnServiceDisconnected() {
    console.log("bleService disconnected")

    this.setState({ isBleServiceConnected: false })
  }

  bleOnDeviceReady() {
    console.log("device connected, initializing")

    this.setState({ fullName: "Initializing..." })
    this.setState({ isBleDeviceReady: true })
    DocumentReader.initializeReaderBleDeviceConfig((response) => {
      this.onInitCompleted(response)
    }, error => {
      this.setState({ fullName: error })
      console.log(error)
    })
  }

  checkPermissionsAndConnect() {
    DocumentReader.isBlePermissionsGranted(granted => {
      if (granted) {
        this.setState({ fullName: "Loading..." })
        if (!this.state.isBleServiceConnected) {
          console.log("connecting bleService")
          DocumentReader.setConfig({
            functionality: {
              useAuthenticator: true,
              btDeviceName: this.state.btDeviceName
            }
          }, s => DocumentReader.startBluetoothService(s => { }, e => { }), e => { })
        } else console.log("bleService already connected")
      } else
        this.setState({ fullName: "ble permissions denied" })
    }, e => console.log(e))
  }

  onInitCompleted(response: string) {
    console.log(response)
    DocumentReader.isRFIDAvailableForUse((canRfid) => {
      if (canRfid) this.setState({ canRfid: true, canRfidTitle: '' })
    }, error => console.log(error))
    DocumentReader.getAvailableScenarios((jstring) => {
      var scenarios = JSON.parse(jstring)
      var items: any = []
      for (var i in scenarios) {
        var scenario = DocumentReaderScenario.fromJson(typeof scenarios[i] === "string" ? JSON.parse(scenarios[i]) : scenarios[i])!.name
        items.push({
          label: scenario,
          id: scenario
        })
      }
      this.setState({ radioButtons: items })
      this.setState({ selectedScenario: this.state.radioButtons[0]['id'] })
      DocumentReader.setConfig({
        functionality: {
          videoCaptureMotionControl: true,
          showCaptureButton: true
        },
        customization: {
          showResultStatusMessages: true,
          showStatusMessages: true
        },
        processParams: {
          scenario: this.state.selectedScenario,
          doRfid: this.state.doRfid,
        },
      }, _ => { }, error => console.log(error))

      DocumentReader.getDocumentReaderIsReady((isReady) => {
        if (isReady) {
          this.setState({ fullName: "Ready" })
          DocumentReader.setRfidDelegate(Enum.RFIDDelegate.NO_PA, _ => { }, error => console.log(error))
        } else
          this.setState({ fullName: "Failed" })
      }, error => console.log(error))
    }, error => console.log(error))
  }

  handleCompletion(completion: DocumentReaderCompletion) {
    if (completion.action === Enum.DocReaderAction.COMPLETE || completion.action === Enum.DocReaderAction.TIMEOUT)
      this.handleResults(completion.results!)
  }

  clearResults() {
    this.setState({ fullName: "Ready", docFront: require('./images/id.png'), portrait: require('./images/portrait.png') })
  }

  scan() {
    this.clearResults()
    var config = new ScannerConfig()
    config.scenario = this.state.selectedScenario
    DocumentReader.scan(config, _ => { }, e => console.log(e))
  }

  recognize() {
    launchImageLibrary({
      mediaType: 'photo',
      includeBase64: true,
      selectionLimit: 10
    }, r => {
      if (r.errorCode != null) {
        console.log("error code: " + r.errorCode)
        console.log("error message: " + r.errorMessage)
        this.setState({ fullName: r.errorMessage })
        return
      }
      if (r.didCancel) return
      this.clearResults()
      this.setState({ fullName: "COPYING IMAGE..." })
      var response = r.assets

      var images: any = []

      for (var i = 0; i < response!.length; i++) {
        images.push(response![i].base64!)
      }
      this.setState({ fullName: "PROCESSING..." })

      var config = new RecognizeConfig()
      config.scenario = this.state.selectedScenario
      config.images = images
      DocumentReader.recognize(config, _ => { }, e => console.log(e))
    })
  }

  displayResults(results: DocumentReaderResults) {
    if (results == null) return

    results.textFieldValueByType(Enum.eVisualFieldType.FT_SURNAME_AND_GIVEN_NAMES, (value: string | undefined) => {
      this.setState({ fullName: value })
    }, (error: string) => console.log(error))

    results.graphicFieldImageByType(Enum.eGraphicFieldType.GF_DOCUMENT_IMAGE, (value: string | undefined) => {
      if (value != null && value != "")
        this.setState({ docFront: { uri: "data:image/png;base64," + value } })
    }, (error: string) => console.log(error))

    results.graphicFieldImageByType(Enum.eGraphicFieldType.GF_PORTRAIT, (value: string | undefined) => {
      if (value != null && value != "")
        this.setState({ portrait: { uri: "data:image/png;base64," + value } })
    }, (error: string) => console.log(error))
  }

  handleResults(results: DocumentReaderResults) {
    if (this.state.doRfid && !isReadingRfid && results != null && results.chipPage != 0) {
      isReadingRfid = true
      DocumentReader.startRFIDReader(_ => { }, _ => { })
    } else {
      isReadingRfid = false
      this.displayResults(results)
    }
  }

  render() {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.container}>
          <Text /><Text />
          <Text style={{
            top: 1,
            left: 1,
            padding: 30,
            fontSize: 20,
            color: "black"
          }}>
            {this.state.fullName}
          </Text>
          <View style={{ flexDirection: "row", padding: 5 }}>
            <View style={{ flexDirection: "column", alignItems: "center" }}>
              <Text style={{
                top: 1,
                right: 1,
                padding: 5,
                color: "black"
              }}>
                Portrait
              </Text>
              <Image
                style={{
                  height: 150,
                  width: 150,
                }}
                source={this.state.portrait}
                resizeMode="contain"
              />
            </View>
            <View style={{ flexDirection: "column", alignItems: "center", padding: 5 }}>
              <Text style={{
                top: 1,
                right: 1,
                padding: 5,
                color: "black"
              }}>
                Document image
              </Text>
              <Image
                style={{
                  height: 150,
                  width: 200,
                }}
                source={this.state.docFront}
                resizeMode="contain"
              />
            </View>
          </View>

          <ScrollView style={{ padding: 5, alignSelf: 'center' }} showsVerticalScrollIndicator={false}>
            <RadioGroup containerStyle={styles.radio}
              radioButtons={this.state.radioButtons}
              onPress={
                (selectedID) => {
                  this.setState({ selectedScenario: selectedID })
                }
              }
              selectedId={this.state.selectedScenario}
            />
          </ScrollView>

          <View style={{ flexDirection: 'row', padding: 5 }}>
            <CheckBox
              containerStyle={{ backgroundColor: '#F5FCFF' }}
              checked={this.state.doRfid}
              title={'Process rfid reading' + this.state.canRfidTitle}
              onPress={() => {
                if (this.state.canRfid) {
                  this.setState({ doRfid: !this.state.doRfid })
                }
              }} />
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text>btDeviceName: </Text>
            <TextInput
              style={styles.input}
              onChangeText={(text) => this.setState({ btDeviceName: text })}
              value={this.state.btDeviceName}
              placeholder="btDeviceName"
            />
          </View>
          <View style={{ flexDirection: 'row' }}>
            <Button color="#4285F4" title="Scan document" onPress={() => this.scan()} />
            <Text style={{ padding: 5 }}></Text>
            <Button color="#4285F4" title="Start service" onPress={() => this.checkPermissionsAndConnect()} />
          </View>
        </View>
      </SafeAreaView>
    )
  }
}

const styles = StyleSheet.create({
  input: {
    height: 40,
    margin: 12,
    borderWidth: 0.5,
    borderRadius: 3,
    padding: 10,
  },
  container: {
    width: '100%',
    height: '100%',
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5FCFF',
    marginBottom: 12,
  },
  radio: {
    alignItems: 'flex-start'
  },
  cancelButton: {
    position: 'absolute',
    bottom: 0,
    right: 20
  }
})