import { useEffect, useState, type FormEvent } from "react";

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

type SetupStatus = { setupRequired: boolean; deploymentReady: boolean };

export default function CommunityAdminSettings() {
  const bridge = window.channelFoundryStudio;
  const [session, setSession] = useState<StudioCommunitySession | null>(null);
  const [setup, setSetup] = useState<SetupStatus | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    if (!bridge) return;
    const next = await bridge.communitySession();
    setSession(next);
    setUsername((current) => current || next.username || "");
    try {
      setSetup(await bridge.communityAdminSetupStatus());
    } catch (reason) {
      setSetup(null);
      setError(errorText(reason));
    }
  };

  useEffect(() => {
    void refresh().catch((reason) => setError(errorText(reason)));
    return bridge?.onDataChanged?.(() => { void refresh().catch(() => undefined); });
  }, []);

  const isFirstSetup = setup?.setupRequired === true;
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!bridge) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (!password) {
        if (isFirstSetup || !session?.configured) throw new Error("Yönetici parolası gerekli.");
        const next = await bridge.communityAdminConnect();
        setSession(next);
        if (!next.connected) throw new Error(next.lastError || "Kayıtlı yönetici bağlantısı kurulamadı.");
        setNotice("Kayıtlı bilgilerle yönetici bağlantısı doğrulandı.");
        return;
      }
      const result = isFirstSetup
        ? await bridge.communityAdminCreateFirst({ username, password })
        : await bridge.communityAdminSave({ username, password });
      setSession(result.session);
      setUsername(result.session.username || username);
      setPassword("");
      setShowPassword(false);
      if (isFirstSetup) setSetup({setupRequired:false, deploymentReady:true});
      setNotice(isFirstSetup
        ? "İlk yönetici oluşturuldu ve bağlantı kaydedildi. Sonraki açılışlarda otomatik bağlanacak."
        : "Mevcut yönetici doğrulandı. Bilgiler güvenli saklandı ve açılışta otomatik bağlanacak.");
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    if (!bridge || !window.confirm("Kayıtlı yönetici bağlantısı silinsin mi?")) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await bridge.communityAdminClear();
      setSession(result.session);
      setUsername("");
      setPassword("");
      setShowPassword(false);
      setNotice("Kayıtlı yönetici bağlantısı silindi. Sunucudaki hesap korunuyor.");
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy(false);
    }
  };

  if (!bridge) return null;

  return <section className="panel community-connection-settings">
    <header>
      <div><small>TOPLULUK YÖNETİMİ</small><h2>{isFirstSetup ? "İlk yöneticiyi oluştur" : "Yönetici bağlantısı"}</h2></div>
      <span className={session?.connected ? "community-connection-state connected" : session?.configured ? "community-connection-state warning" : "community-connection-state"}>
        <span className="local-dot"/>{session?.connected ? "Bağlı" : isFirstSetup ? "İlk kurulum" : session?.configured ? "Bağlantı bekliyor" : "Yapılandırılmadı"}
      </span>
    </header>
    <p>{isFirstSetup
      ? "Sitede henüz yönetici hesabı yok. Bu ekrandan bir kez oluşturabilirsin; Studio, kayıtlı FTPS deploy bağlantısıyla yetkiyi doğrular."
      : "Sitede yönetici hesabı varsa kullanıcı adı ve parolasıyla bağlan. Bilgiler cihazda güvenli saklanır; sonraki yayınlarda yeniden girilmez."}</p>
    <div className="community-connection-facts">
      <div><span>Sunucu</span><strong title={session?.endpoint}>{session?.endpoint || "—"}</strong></div>
      <div><span>Otomatik bağlantı</span><strong>{session?.configured ? "Etkin" : "Kapalı"}</strong></div>
      <div><span>Yönetici</span><strong>{session?.username || "—"}</strong></div>
      <div><span>Parola saklama</span><strong>{session?.secureStorageAvailable ? "Sistem korumalı" : "Kullanılamıyor"}</strong></div>
    </div>
    <form onSubmit={(event) => void save(event)}>
      <label><span>Yönetici kullanıcı adı</span><input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" minLength={3} maxLength={32} required/></label>
      <label><span>{isFirstSetup ? "Yeni yönetici parolası" : "Yönetici parolası"}</span><div className="community-password-field">
        <input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)}
          autoComplete={isFirstSetup ? "new-password" : "current-password"} minLength={isFirstSetup ? 8 : undefined}
          placeholder={isFirstSetup ? "En az 8 karakter" : session?.configured ? "Kayıtlı parola korunur" : "Mevcut yönetici parolası"}/>
        <button type="button" className="secondary-button" disabled={!password} onClick={() => setShowPassword((current) => !current)}>{showPassword ? "Gizle" : "Göster"}</button>
      </div></label>
      {isFirstSetup && !setup?.deploymentReady && <div className="community-admin-notice error">
        Kayıtlı FTPS deploy bağlantısı bulunamadı. Önce bu proje için deploy bağlantısını kurmak gerekiyor.
      </div>}
      {(error || notice || session?.lastError) && <div className={error || session?.lastError && !session.connected ? "community-admin-notice error" : "community-admin-notice"}>{error || notice || session?.lastError}</div>}
      {!session?.secureStorageAvailable && <div className="community-admin-notice error">Sistem korumalı parola saklama kullanılamıyor; kalıcı yönetici bağlantısı kaydedilemez.</div>}
      <div className="community-connection-actions">
        {session?.configured && <button type="button" className="text-button" disabled={busy} onClick={() => void clear()}>Kayıtlı bilgileri sil</button>}
        <button className="primary-button" type="submit"
          disabled={busy || !username || !session?.secureStorageAvailable || (isFirstSetup && (!setup?.deploymentReady || password.length < 8))}>
          {busy ? (isFirstSetup ? "Yönetici oluşturuluyor…" : "Doğrulanıyor…") : isFirstSetup ? "Yönetici oluştur ve bağlan" : password ? "Bağlan ve kaydet" : "Bağlantıyı yenile"}
        </button>
      </div>
    </form>
  </section>;
}
