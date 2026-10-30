package app.muuvlink;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.webkit.GeolocationPermissions;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;

public class MainActivity extends BridgeActivity {

    // Sitenin konum isteği (navigator.geolocation) yalnız yaklaşık izinle karşılanır.
    // Capacitor'ın kendi akışı hassas izni de ister; onu bildirmediğimiz için Android 11
    // ve altında konum hiç verilmezdi (12+ yaklaşığa düşüyor). Tek akış: yalnız yaklaşık.
    private String geoOrigin;
    private GeolocationPermissions.Callback geoCallback;

    private final ActivityResultLauncher<String> coarseLocation =
        registerForActivityResult(new ActivityResultContracts.RequestPermission(), granted -> {
            if (geoCallback != null) geoCallback.invoke(geoOrigin, granted, false);
            geoOrigin = null;
            geoCallback = null;
        });

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        bridge.getWebView().setWebChromeClient(new BridgeWebChromeClient(bridge) {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.ACCESS_COARSE_LOCATION)
                    == PackageManager.PERMISSION_GRANTED) {
                    callback.invoke(origin, true, false);
                    return;
                }
                geoOrigin = origin;
                geoCallback = callback;
                coarseLocation.launch(Manifest.permission.ACCESS_COARSE_LOCATION);
            }
        });
    }
}
