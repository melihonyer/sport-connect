# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# ─────────────────────────────────────────────────────────────
# Capacitor + R8 (Google Play kod optimizasyonu şartı)
#
# Capacitor, eklenti izinlerini çalışma anında @CapacitorPlugin ve
# @Permission anotasyonlarından OKUR. R8 varsayılan olarak anotasyon
# niteliklerini atar; bu durumda getPermissionState() null döner ve
# uygulama push bildirimi izni isterken çöker:
#   java.lang.NullPointerException at Plugin.getPermissionStates
# Bu yüzden anotasyon nitelikleri korunmalı.
# ─────────────────────────────────────────────────────────────
-keepattributes *Annotation*
-keepattributes RuntimeVisibleAnnotations
-keepattributes RuntimeVisibleParameterAnnotations
-keepattributes InnerClasses
-keepattributes Signature
-keepattributes EnclosingMethod

# Anotasyon tiplerinin kendisi de silinmemeli
-keep @interface com.getcapacitor.annotation.**
-keep @interface com.getcapacitor.**
