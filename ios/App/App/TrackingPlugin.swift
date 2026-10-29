import Capacitor
import AppTrackingTransparency

/// Apple'ın takip izni (App Tracking Transparency). Site `analytics.js` bu eklentiye bakar:
/// izin yoksa Meta pikseli yüklenmez, sunucu Meta'ya olay göndermez.
@objc(TrackingPlugin)
public class TrackingPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TrackingPlugin"
    public let jsName = "Tracking"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermission", returnType: CAPPluginReturnPromise)
    ]

    private func statusName(_ status: ATTrackingManager.AuthorizationStatus) -> String {
        switch status {
        case .authorized: return "authorized"
        case .denied: return "denied"
        case .restricted: return "restricted"
        case .notDetermined: return "notDetermined"
        @unknown default: return "denied"
        }
    }

    @objc func getStatus(_ call: CAPPluginCall) {
        call.resolve(["status": statusName(ATTrackingManager.trackingAuthorizationStatus)])
    }

    @objc func requestPermission(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            ATTrackingManager.requestTrackingAuthorization { status in
                call.resolve(["status": self.statusName(status)])
            }
        }
    }
}
