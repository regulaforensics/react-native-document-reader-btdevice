import React, { Component } from 'react'
import { StyleSheet, View, Button, Text, Image, ScrollView, NativeEventEmitter, Platform, TouchableOpacity } from 'react-native'
import DocumentReader, { Enum, DocumentReaderCompletion, DocumentReaderScenario, RNRegulaDocumentReader } from '@regulaforensics/api_module_place_holder'
import RadioGroup from 'react-native-radio-buttons-group'
import * as Progress from 'react-native-progress'
import CheckBox from 'react-native-check-box'
import { LogBox, TextInput } from 'react-native';

LogBox.ignoreLogs(['new NativeEventEmitter']);
const eventManager = new NativeEventEmitter(RNRegulaDocumentReader)

var isReadingRfid = false;

export default class App extends Component {
  constructor(props) {
    super(props)
    eventManager.addListener('prepareDatabaseProgressChangeEvent', e => this.setState({ fullName: "Downloading database: " + e["msg"] + "%" }))
    eventManager.addListener('completionEvent', e => this.handleCompletion(DocumentReaderCompletion.fromJson(JSON.parse(e["msg"]))))
    eventManager.addListener('rfidNotificationCompletionEvent', e => console.log("rfidNotificationCompletionEvent: " + e["msg"]))
    eventManager.addListener('paCertificateCompletionEvent', e => console.log("paCertificateCompletionEvent: " + e["msg"]))

    eventManager.addListener('bleOnServiceConnectedEvent', e => this.bleOnServiceConnected())
    eventManager.addListener('bleOnServiceDisconnectedEvent', e => this.bleOnServiceDisconnected())
    eventManager.addListener('bleOnDeviceReadyEvent', e => this.bleOnDeviceReady())

    DocumentReader.prepareDatabase("FullAuth", (respond) => {
      console.log(respond)
      this.setState({ fullName: "Database prepared" })
    }, error => console.log(error))

    this.state = {
      btDeviceName: "Regula 0000",
      isBleServiceConnected: false,
      isBleDeviceReady: false,
      getDocumentReaderIsReady: false,
      fullName: "Please wait...",
      doRfid: false,
      isReadingRfidCustomUi: false,
      canRfid: false,
      canRfidTitle: '(unavailable)',
      scenarios: [],
      selectedScenario: "",
      portrait: require('./images/portrait.png'),
      docFront: require('./images/id.png'),
      radio: < RadioGroup containerStyle={styles.radio}
        radioButtons={
          [{ label: 'Loading', id: 0 }]}
        onPress={null}
      />
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

  onInitCompleted(response) {
    console.log(response)
    DocumentReader.isRFIDAvailableForUse((canRfid) => {
      if (canRfid) {
        this.setState({ canRfid: true, rfidUIHeader: "Reading RFID", rfidDescription: "Place your phone on top of the NFC tag", rfidUIHeaderColor: "black" })
        this.setState({ canRfidTitle: '' })
      }
    }, error => console.log(error))
    DocumentReader.getAvailableScenarios((jstring) => {
      var scenariosTemp = JSON.parse(jstring)
      var scenariosL = []
      for (var i in scenariosTemp) {
        scenariosL.push({
          label: DocumentReaderScenario.fromJson(typeof scenariosTemp[i] === "string" ? JSON.parse(scenariosTemp[i]) : scenariosTemp[i]).name,
          id: i
        })
      }
      this.setState({ scenarios: scenariosL })
      this.setState({ selectedScenario: this.state.scenarios[0]['label'] })
      this.setState({ radio: null })
      this.setState({
        radio: < RadioGroup containerStyle={styles.radio}
          radioButtons={this.state.scenarios}
          onPress={
            (data) => {
              var selectedItem
              for (var index in data)
                if (data[index]['selected'])
                  selectedItem = data[index]['label']
              this.setState({ selectedScenario: selectedItem })
            }
          }
        />
      })
      DocumentReader.getDocumentReaderIsReady((isReady) => {
        if (isReady) {
          this.setState({ getDocumentReaderIsReady: true })
          this.setState({ fullName: "Ready" })
          DocumentReader.setRfidDelegate(Enum.RFIDDelegate.NO_PA, (r) => { }, error => console.log(error))
          // addCertificates()
        } else
          this.setState({ fullName: "Failed" })
      }, error => console.log(error))
    }, error => console.log(error))
  }

  handleCompletion(completion) {
    if (this.state.isReadingRfidCustomUi && (completion.action === Enum.DocReaderAction.CANCEL || completion.action === Enum.DocReaderAction.ERROR))
      this.hideRfidUI()
    if (this.state.isReadingRfidCustomUi && completion.action === Enum.DocReaderAction.NOTIFICATION)
      this.updateRfidUI(completion.results.documentReaderNotification)
    if (completion.action === Enum.DocReaderAction.COMPLETE)
      if (this.state.isReadingRfidCustomUi)
        if (completion.results.rfidResult !== 1)
          this.restartRfidUI()
        else {
          this.hideRfidUI()
          this.displayResults(completion.results)
        }
      else
        this.handleResults(completion.results)
    if (completion.action === Enum.DocReaderAction.TIMEOUT)
      this.handleResults(completion.results)
    if (completion.action === Enum.DocReaderAction.CANCEL || completion.action === Enum.DocReaderAction.ERROR)
      isReadingRfid = false
  }

  showRfidUI() {
    // show animation
    this.setState({ isReadingRfidCustomUi: true })
  }

  hideRfidUI() {
    // show animation
    this.restartRfidUI()
    this.setState({ isReadingRfidCustomUi: false, rfidUIHeader: "Reading RFID", rfidUIHeaderColor: "black" })
  }

  restartRfidUI() {
    this.setState({ rfidUIHeaderColor: "red", rfidUIHeader: "Failed!", rfidDescription: "Place your phone on top of the NFC tag", rfidProgress: -1 })
  }

  updateRfidUI(results) {
    if (results.code === Enum.eRFID_NotificationCodes.RFID_NOTIFICATION_PCSC_READING_DATAGROUP)
      this.setState({ rfidDescription: Enum.eRFID_DataFile_Type.getTranslation(results.number) })
    this.setState({ rfidUIHeader: "Reading RFID", rfidUIHeaderColor: "black", rfidProgress: results.value / 100 })
    if (Platform.OS === 'ios')
      DocumentReader.setRfidSessionStatus(this.state.rfidDescription + "\n" + results.value + "%", e => { }, e => { })
  }

  clearResults() {
    this.setState({ fullName: "Ready", docFront: require('./images/id.png'), portrait: require('./images/portrait.png') })
  }

  displayResults(results) {
    this.setState({ fullName: results.getTextFieldValueByType({ fieldType: Enum.eVisualFieldType.FT_SURNAME_AND_GIVEN_NAMES }) })
    if (results.getGraphicFieldImageByType({ fieldType: Enum.eGraphicFieldType.GF_DOCUMENT_IMAGE }) != null)
      this.setState({ docFront: { uri: "data:image/png;base64," + results.getGraphicFieldImageByType({ fieldType: Enum.eGraphicFieldType.GF_DOCUMENT_IMAGE }) } })
    if (results.getGraphicFieldImageByType({ fieldType: Enum.eGraphicFieldType.GF_PORTRAIT }) != null)
      this.setState({ portrait: { uri: "data:image/png;base64," + results.getGraphicFieldImageByType({ fieldType: Enum.eGraphicFieldType.GF_PORTRAIT }) } })
  }

  customRFID() {
    this.showRfidUI()
    DocumentReader.readRFID(e => { }, e => { })
  }

  usualRFID() {
    isReadingRfid = true
    DocumentReader.startRFIDReader(e => { }, e => { })
  }

  handleResults(results) {
    if (this.state.doRfid && !isReadingRfid && results != null && results.chipPage != 0) {
      // this.customRFID()
      this.usualRFID()
    } else {
      isReadingRfid = false
      this.displayResults(results)
    }
  }

  render() {
    return (
      <View style={styles.container}>
        {(this.state.isReadingRfidCustomUi && Platform.OS === 'android') && <View style={styles.container}>
          <Text style={{ paddingBottom: 30, fontSize: 23, color: this.state.rfidUIHeaderColor }}>{this.state.rfidUIHeader}</Text>
          <Text style={{ paddingBottom: 50, fontSize: 20 }}>{this.state.rfidDescription}</Text>
          <Progress.Bar width={200} useNativeDriver={true} color="#4285F4" progress={this.state.rfidProgress} />
          <TouchableOpacity style={styles.cancelButton} onPress={() => { this.hideRfidUI() }}>
            <Text style={{ fontSize: 20 }}>X</Text>
          </TouchableOpacity>
        </View>
        }
        {!this.state.isReadingRfidCustomUi && <View style={styles.container}>
          <Text style={{
            top: 1,
            left: 1,
            padding: 30,
            fontSize: 20,
          }}>
            {this.state.fullName}
          </Text>
          <View style={{ flexDirection: "row", padding: 5 }}>
            <View style={{ flexDirection: "column", alignItems: "center" }}>
              <Text style={{
                top: 1,
                right: 1,
                padding: 5,
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
            {this.state.radio}
          </ScrollView>

          <View style={{ flexDirection: 'row', padding: 5 }}>
            <CheckBox
              isChecked={this.state.doRfid}
              onClick={() => {
                if (this.state.canRfid) {
                  this.setState({ doRfid: !this.state.doRfid })
                }
              }}
              disabled={!this.state.canRfid}
            />
            <Text
              style={{ padding: 5 }}
              onPress={() => {
                if (this.state.canRfid) {
                  this.setState({ doRfid: !this.state.doRfid })
                }
              }}>
              {'Process rfid reading' + this.state.canRfidTitle}
            </Text>
          </View>
          {!this.state.getDocumentReaderIsReady && <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text>btDeviceName: </Text>
            <TextInput
              style={styles.input}
              onChangeText={(text) => this.setState({ btDeviceName: text })}
              value={this.state.btDeviceName}
              placeholder="btDeviceName"
            />
          </View>}

          <View style={{ flexDirection: 'row' }}>
            <Button color="#4285F4"
              onPress={() => {
                if (!this.state.getDocumentReaderIsReady) return
                this.clearResults()
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
                }, e => { }, error => console.log(error))

                DocumentReader.showScanner(s => { }, e => console.log(e))
              }}
              title="Scan document"
            />
            <Text style={{ padding: 5 }}></Text>
            <Button color="#4285F4"
              onPress={() => this.checkPermissionsAndConnect()}
              title="     Start service    "
            />
          </View>
        </View>
        }
      </View>
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
  welcome: {
    fontSize: 20,
    textAlign: 'center',
    margin: 10,
  },
  instructions: {
    textAlign: 'center',
    color: '#333333',
    marginBottom: 5,
  },
  cancelButton: {
    position: 'absolute',
    bottom: 0,
    right: 20
  }
})
