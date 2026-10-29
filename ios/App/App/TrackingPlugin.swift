import UIKit
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
        DispatchQueue.main.async { self.ask(call, retries: 3) }
    }

    /// Apple'ın penceresi yalnız uygulama ETKİNKEN görünür. Konum/bildirim izni penceresi açıkken
    /// sorulursa pencere çıkmadan "notDetermined" döner — o yüzden etkinleşmeyi bekleyip yeniden sorar.
    private func ask(_ call: CAPPluginCall, retries: Int) {
        guard UIApplication.shared.applicationState == .active else {
            var token: NSObjectProtocol?
            token = NotificationCenter.default.addObserver(
                forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main
            ) { _ in
                if let token = token { NotificationCenter.default.removeObserver(token) }
                self.ask(call, retries: retries)
            }
            return
        }
        ATTrackingManager.requestTrackingAuthorization { status in
            if status == .notDetermined && retries > 0 {
                DispatchQueue.main.asyncAfter(deadline: .now() + 1) { self.ask(call, retries: retries - 1) }
                return
            }
            call.resolve(["status": self.statusName(status)])
        }
    }
}
