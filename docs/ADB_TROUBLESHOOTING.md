# ADB and First-Connection Troubleshooting

This guide is for cases where an Android device is connected by USB but Wirebound cannot start or verify reverse tethering.

Wirebound uses Android Debug Bridge (ADB) to detect the phone and start the Gnirehtet VPN client. A USB cable being physically connected does not necessarily mean ADB can communicate with the device.

Official Android references:

- Run apps on a hardware device: https://developer.android.com/studio/run/device
- Windows OEM USB drivers: https://developer.android.com/studio/run/oem-usb
- ADB documentation: https://developer.android.com/tools/adb

## Quick checklist

Check these in order:

1. Use a USB cable that supports **data**, not only charging.
2. Unlock the Android device.
3. Enable **Developer options**.
4. Enable **USB debugging**.
5. Reconnect the USB cable.
6. Accept the **Allow USB debugging?** / RSA authorization prompt on Android.
7. Make sure Windows has a working Android/OEM USB driver.
8. Open Wirebound and wait a few seconds for device detection.
9. Run **Diagnostics** if the device is still not ready.
10. Start the connection and then accept the **VPN permission** prompt on Android.

## What each Wirebound ADB status means

### No device detected

Windows/ADB cannot currently see the Android device.

Check:

- try another known-good data cable;
- try another USB port;
- unlock the phone;
- enable USB debugging;
- reconnect the cable after enabling USB debugging;
- change the phone's USB mode from charge-only if the firmware requires it;
- install or repair the correct Windows OEM USB driver.

A phone charging successfully is not proof that the cable supports USB data.

### Unauthorized

ADB can see the device, but this Windows computer has not been authorized.

On the phone:

1. keep the screen unlocked;
2. look for **Allow USB debugging?**;
3. optionally enable **Always allow from this computer**;
4. tap **Allow**.

If the prompt never appears:

1. disconnect the cable;
2. in Android Developer options, use **Revoke USB debugging authorizations**;
3. reconnect the device;
4. approve the new prompt.

### Offline

ADB knows about the device but cannot currently communicate with it correctly.

Try, in order:

1. unlock the phone;
2. disconnect and reconnect USB;
3. try another USB port/cable;
4. toggle USB debugging off and on;
5. close and reopen Wirebound.

If Android Studio or another ADB tool is open, it can remain open. Wirebound intentionally uses the standard shared ADB server on port **5037** instead of creating a private incompatible server.

### No access

ADB detected a transport but Windows cannot access it correctly.

This usually points to the Windows USB driver, cable/port, or system permissions rather than the Gnirehtet relay itself.

Check the OEM driver instructions:

https://developer.android.com/studio/run/oem-usb

For some manufacturers, Windows Update may install an appropriate driver automatically. Other manufacturers provide their own USB driver package.

### ADB unavailable

Wirebound could not successfully query ADB itself.

Run **Diagnostics** and check:

- **ADB runtime**
- **ADB response**

For a normal installed release, the ADB runtime is bundled by Wirebound. If the packaged runtime is missing or damaged, reinstall a release from the official Wirebound GitHub Releases page instead of downloading random ADB binaries into the application folder.

Wirebound uses a content-addressed ADB cache under:

`%LOCALAPPDATA%\Wirebound\runtime`

This allows Wirebound to share the standard ADB daemon without a running daemon locking files inside the installed application.

## The device is ADB-ready but tethering is still waiting

ADB readiness and Gnirehtet tethering are separate states.

After clicking **Start Connection**, Android should display a VPN permission prompt for Gnirehtet. Keep the device unlocked and approve the prompt.

If the device remains in **Waiting**:

- check the phone screen for the VPN prompt;
- make sure another VPN is not preventing the new VPN service from starting;
- run Wirebound Diagnostics;
- check whether **Gnirehtet installed** and **VPN client active** are reported correctly.

Some Android OEM firmware adds extra background, VPN, or security restrictions. If basic ADB access is already working, treat these as a separate Android/Gnirehtet problem rather than reinstalling ADB repeatedly.

## Multiple Android devices

Wirebound can see more than one ADB device.

Check the two columns separately:

- **ADB** tells you whether Wirebound can communicate with that phone.
- **Tethering** tells you whether the Gnirehtet VPN client is actually active on that phone.

One phone may be **Connected** while another is still **Waiting**, **Unauthorized**, or **Unavailable**. A global engine state does not mean every attached device succeeded.

## Verify real internet access

An active relay and an active Android VPN client are necessary, but they do not independently prove end-to-end internet access.

Use the **Speed Test** action for a device after its Tethering state is **Connected**. Wirebound opens Fast.com on that Android device so you can verify actual traffic.

## Create a support report

If the problem remains:

1. open **Diagnostics**;
2. click **Run Diagnostics**;
3. click **Export Report**;
4. attach the generated text file to a GitHub issue and describe what you expected versus what happened.

The exported report uses masked device identifiers. Raw engine logs are deliberately not included in the exported file because they have not been guaranteed to be privacy-sanitized.

## Before reporting a bug

Please include:

- what Wirebound showed for **ADB**;
- what it showed for **Tethering**;
- whether Android displayed the USB debugging prompt;
- whether Android displayed the Gnirehtet VPN prompt;
- the exported support report;
- the exact step where the behavior stopped matching this guide.

Do not post full device serial numbers or private information in public issues.

---

# Panduan ADB dan Koneksi Pertama

Bagian ini adalah versi ringkas Bahasa Indonesia.

Kalau HP sudah dicolok tetapi Wirebound belum bisa memakainya, periksa berurutan:

1. Pastikan kabel USB mendukung **transfer data**, bukan hanya charging.
2. Buka kunci HP.
3. Aktifkan **Opsi pengembang**.
4. Aktifkan **USB debugging**.
5. Cabut lalu colok ulang kabel.
6. Setujui prompt **Izinkan USB debugging?** di HP.
7. Pastikan driver USB Android/OEM di Windows benar.
8. Buka Wirebound dan tunggu beberapa detik.
9. Kalau belum siap, jalankan **Diagnostik**.
10. Klik **Mulai Koneksi**, lalu setujui izin **VPN Gnirehtet** di HP.

Arti status utama:

- **Tidak ada perangkat**: ADB belum melihat HP. Fokus ke kabel, port USB, USB debugging, dan driver.
- **Belum izin / Unauthorized**: HP terlihat tetapi komputer belum disetujui. Buka kunci HP dan terima prompt USB debugging.
- **Offline**: HP pernah terdeteksi tetapi komunikasi ADB sedang bermasalah. Sambungkan ulang dan periksa USB debugging.
- **Tidak ada akses**: biasanya masalah driver Windows, kabel/port, atau izin sistem.
- **ADB tidak tersedia**: jalankan Diagnostik untuk mengecek runtime ADB dan respons ADB.
- **ADB Siap tetapi Tethering Menunggu**: ADB sudah benar; cek prompt izin VPN Gnirehtet di layar HP.

Kalau masih gagal, gunakan **Diagnostik > Ekspor Laporan** dan lampirkan hasilnya saat membuat issue. Serial perangkat di laporan ekspor dimasking.
