import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  sendEmailVerification,
  EmailAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  updatePassword,
  verifyBeforeUpdateEmail,
  deleteUser,
} from 'firebase/auth';
import { doc, setDoc, getDoc, deleteDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase/config';
import { hashEmail } from '../utils/crypto';

export interface OAuthDiagnostics {
  hostname: string;
  pathname: string;
  search: string;
  hash: string;
  isStandalone: boolean;
  authDomain: string;
  authState: string;
  redirectResultStatus: 'pending' | 'success' | 'null' | 'error';
  redirectErrorCode?: string;
  redirectErrorMessage?: string;
  timestamp: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  authError: string | null;
  oauthDiagnostics: OAuthDiagnostics | null;
  clearAuthError: () => void;
  signUp: (name: string, email: string, password: string, keepSignedIn: boolean) => Promise<void>;
  signIn: (email: string, password: string, keepSignedIn: boolean) => Promise<void>;
  signInWithGoogle: (keepSignedIn: boolean) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  reloadUser: () => Promise<boolean>;
  updateDisplayName: (name: string) => Promise<void>;
  updateUserPhoto: (photoURL: string | null) => Promise<void>;
  reauthenticateUser: (password?: string) => Promise<void>;
  changeUserPassword: (currentPassword: string, newPassword: string) => Promise<void>;
  changeUserEmail: (currentPassword: string, newEmail: string) => Promise<void>;
  deleteUserAccount: (password?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapAuthErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case 'auth/email-already-in-use':
      return 'Já existe uma conta cadastrada com este e-mail. Faça login ou recupere sua senha.';
    case 'auth/invalid-email':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'E-mail ou senha incorretos.';
    case 'auth/operation-not-allowed':
      return 'Operação não permitida. O provedor de autenticação (Email/Senha ou Google) precisa estar habilitado no console do Firebase.';
    case 'auth/weak-password':
      return 'A senha é muito fraca. Escolha uma senha com pelo menos 6 caracteres.';
    case 'auth/user-disabled':
      return 'Esta conta foi desativada.';
    case 'auth/network-request-failed':
      return 'Erro de conexão de rede. Verifique sua internet e tente novamente.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas sem sucesso. Por segurança, o acesso foi temporariamente bloqueado.';
    case 'auth/account-exists-with-different-credential':
      return 'Já existe uma conta com este e-mail usando outro método de acesso (como Google). Faça login com o método original.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'O processo de login foi cancelado pelo usuário.';
    case 'auth/popup-blocked':
      return 'O pop-up de login foi bloqueado pelo navegador. Tentando redirecionamento...';
    case 'auth/unauthorized-domain':
      return 'Domínio não autorizado no console do Firebase para autenticação Google.';
    case 'auth/web-storage-unsupported':
      return 'O armazenamento do navegador não é suportado ou foi bloqueado pelo Safari ITP.';
    case 'auth/requires-recent-login':
      return 'Por segurança, confirme sua senha atual antes de realizar esta alteração.';
    default:
      return 'Ocorreu um erro na autenticação. Verifique os dados e tente novamente.';
  }
}

function isTemporaryRedirectStateError(err: unknown): boolean {
  if (!err) return false;
  const code = (err as { code?: string })?.code || '';
  const message = (err as { message?: string })?.message || String(err);

  const isKnownCode =
    code === 'auth/missing-initial-state' ||
    code === 'auth/web-storage-unsupported' ||
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/cancelled-popup-request';

  const isKnownMsg =
    message.includes('missing initial state') ||
    message.includes('web-storage-unsupported') ||
    message.includes('sessionStorage');

  return isKnownCode || isKnownMsg;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [oauthDiagnostics, setOauthDiagnostics] = useState<OAuthDiagnostics | null>(null);

  useEffect(() => {
    let isMounted = true;
    let authStateResolved = false;
    let redirectResolved = false;

    const checkLoadingComplete = () => {
      if (authStateResolved && redirectResolved && isMounted) {
        setLoading(false);
      }
    };

    // 1. Attach onAuthStateChanged as the primary listener for user session updates
    const unsubListener = onAuthStateChanged(auth, async (currentUser) => {
      if (!isMounted) return;
      if (currentUser) {
        setUser(currentUser);
        try {
          await syncUserProfile(currentUser);
        } catch (syncErr) {
          console.warn('[AuthContext] User directory sync warning:', syncErr);
        }
      } else if (!auth.currentUser) {
        setUser(null);
      }
      authStateResolved = true;
      checkLoadingComplete();
    });

    // 2. Process OAuth redirect result on boot before declaring loading = false
    const processRedirectResult = async () => {
      const isStandalone =
        typeof window !== 'undefined' &&
        ((window.navigator as unknown as { standalone?: boolean })?.standalone === true ||
          window.matchMedia('(display-mode: standalone)').matches);

      const diagInfo: OAuthDiagnostics = {
        hostname: typeof window !== 'undefined' ? window.location.hostname : '',
        pathname: typeof window !== 'undefined' ? window.location.pathname : '',
        search: typeof window !== 'undefined' ? window.location.search || '(vazio)' : '',
        hash: typeof window !== 'undefined' ? window.location.hash || '(vazio)' : '',
        isStandalone,
        authDomain: (auth.app.options as { authDomain?: string })?.authDomain || 'não especificado',
        authState: auth.currentUser ? `Autenticado (${auth.currentUser.uid})` : 'Não autenticado',
        redirectResultStatus: 'pending',
        timestamp: new Date().toLocaleTimeString(),
      };

      try {
        await setPersistence(auth, browserLocalPersistence);
        const redirectResult = await getRedirectResult(auth);
        if (redirectResult && redirectResult.user && isMounted) {
          console.log('[AuthContext] Google OAuth redirect success:', redirectResult.user.uid);
          diagInfo.redirectResultStatus = 'success';
          diagInfo.authState = `Autenticado (${redirectResult.user.uid})`;
          if (isMounted) setOauthDiagnostics({ ...diagInfo });

          await syncUserProfile(redirectResult.user);
          setUser(redirectResult.user);
        } else {
          diagInfo.redirectResultStatus = 'null';
          if (isMounted) setOauthDiagnostics({ ...diagInfo });
        }
      } catch (err: unknown) {
        if (isTemporaryRedirectStateError(err)) {
          console.info('[AuthContext] Ignored temporary OAuth redirect state loss gracefully:', err);
          diagInfo.redirectResultStatus = 'null';
          diagInfo.redirectErrorCode = (err as { code?: string })?.code || 'state_loss_ignored';
          if (isMounted) setOauthDiagnostics({ ...diagInfo });
        } else {
          console.error('[AuthContext] OAuth redirect error:', err);
          const code = (err as { code?: string })?.code || '';
          const rawMsg = (err as Error)?.message || String(err);
          diagInfo.redirectResultStatus = 'error';
          diagInfo.redirectErrorCode = code || 'erro_desconhecido';
          diagInfo.redirectErrorMessage = rawMsg;
          if (isMounted) setOauthDiagnostics({ ...diagInfo });

          if (!auth.currentUser && isMounted) {
            const msg = mapAuthErrorMessage(code);
            setAuthError(msg);
          }
        }
      } finally {
        redirectResolved = true;
        checkLoadingComplete();
      }
    };

    processRedirectResult();

    return () => {
      isMounted = false;
      if (unsubListener) {
        unsubListener();
      }
    };
  }, []);

  const clearAuthError = () => setAuthError(null);

  // Sync user profile in Firestore and searchable user_directory
  const syncUserProfile = async (u: User, displayName?: string) => {
    const userDocRef = doc(db, 'users', u.uid);
    const directoryDocRef = doc(db, 'user_directory', u.uid);
    const resolvedName = displayName || u.displayName || u.email?.split('@')[0] || 'Usuário';
    const emailLower = (u.email || '').toLowerCase().trim();
    const now = new Date().toISOString();

    try {
      const existing = await getDoc(userDocRef);
      if (!existing.exists()) {
        await setDoc(userDocRef, {
          userId: u.uid,
          displayName: resolvedName,
          email: u.email || '',
          createdAt: now,
          updatedAt: now,
        });
      } else if (displayName && existing.data()?.displayName !== displayName) {
        await setDoc(
          userDocRef,
          {
            displayName,
            updatedAt: now,
          },
          { merge: true }
        );
      }
      const savedPhoto = existing.exists() ? existing.data()?.photoURL : null;
      const cachedPhoto = localStorage.getItem(`user_photo_${u.uid}`);
      const effectivePhoto = u.photoURL || savedPhoto || cachedPhoto || null;
      if (effectivePhoto && u.photoURL !== effectivePhoto) {
        setUser((prev) => (prev ? { ...prev, photoURL: effectivePhoto } : prev));
      }

      // Keep directory entry synced for partner invitations by email
      if (emailLower) {
        const directoryPayload = {
          uid: u.uid,
          email: emailLower,
          displayName: resolvedName,
          updatedAt: now,
        };
        await setDoc(directoryDocRef, directoryPayload, { merge: true });

        // Also write to user_directory_lookup using deterministic SHA-256 hash of email
        try {
          const emailHash = await hashEmail(emailLower);
          const lookupDocRef = doc(db, 'user_directory_lookup', emailHash);
          await setDoc(lookupDocRef, directoryPayload, { merge: true });
        } catch (lookupErr) {
          console.warn('Sync lookup doc error:', lookupErr);
        }
      }
    } catch (err) {
      console.warn('Sync profile error:', err);
    }
  };

  const signUp = async (name: string, email: string, password: string, keepSignedIn: boolean) => {
    setAuthError(null);
    try {
      await setPersistence(auth, keepSignedIn ? browserLocalPersistence : browserSessionPersistence);
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (name.trim()) {
        await updateProfile(cred.user, { displayName: name.trim() });
      }
      try {
        await sendEmailVerification(cred.user);
      } catch (err) {
        console.warn('Could not send verification email:', err);
      }
      await syncUserProfile(cred.user, name.trim());
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      const msg = mapAuthErrorMessage(code);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const signIn = async (email: string, password: string, keepSignedIn: boolean) => {
    setAuthError(null);
    try {
      await setPersistence(auth, keepSignedIn ? browserLocalPersistence : browserSessionPersistence);
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await syncUserProfile(cred.user);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      const msg = mapAuthErrorMessage(code);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const isStandaloneMode = (): boolean => {
    if (typeof window === 'undefined') return false;
    return (
      (window.navigator as unknown as { standalone?: boolean })?.standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches
    );
  };

  const signInWithGoogle = async (_keepSignedIn: boolean) => {
    setAuthError(null);
    try {
      await setPersistence(auth, browserLocalPersistence);
      const cred = await signInWithPopup(auth, googleProvider);
      if (cred && cred.user) {
        await syncUserProfile(cred.user);
      }
    } catch (popupErr: unknown) {
      const code = (popupErr as { code?: string })?.code || '';
      console.warn('[AuthContext] signInWithPopup error code:', code, popupErr);

      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return;
      }

      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-environment' ||
        isStandaloneMode()
      ) {
        console.log('[AuthContext] Falling back to signInWithRedirect...');
        try {
          await setPersistence(auth, browserLocalPersistence);
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectErr: unknown) {
          const rCode = (redirectErr as { code?: string })?.code || '';
          const msg = mapAuthErrorMessage(rCode);
          setAuthError(msg);
          throw redirectErr;
        }
      }

      const msg = mapAuthErrorMessage(code);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  // Safe password reset: do NOT throw or reveal whether user email exists (prevents account enumeration)
  const resetPassword = async (email: string) => {
    setAuthError(null);
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err: unknown) {
      console.info('[AuthContext] Password reset request finished (generic status response):', err);
    }
  };

  const signOutUser = async () => {
    setAuthError(null);
    try {
      if (typeof window !== 'undefined') {
        try {
          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('mc_fin_') || key.startsWith('money_challenge_'))) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach((k) => localStorage.removeItem(k));
        } catch {}
      }
      await signOut(auth);
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

  const sendVerificationEmail = async () => {
    setAuthError(null);
    try {
      if (auth.currentUser && !auth.currentUser.emailVerified) {
        await sendEmailVerification(auth.currentUser);
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      const msg = mapAuthErrorMessage(code);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const reloadUser = async (): Promise<boolean> => {
    setAuthError(null);
    try {
      if (auth.currentUser) {
        await auth.currentUser.reload();
        setUser({ ...auth.currentUser });
        return auth.currentUser.emailVerified;
      }
      return false;
    } catch (err) {
      console.warn('Reload user error:', err);
      return false;
    }
  };

  const updateDisplayName = async (name: string): Promise<void> => {
    const clean = name.trim().replace(/\s+/g, ' ').slice(0, 50);
    if (!clean) throw new Error('Informe um nome.');
    if (!auth.currentUser) return;
    await updateProfile(auth.currentUser, { displayName: clean });
    await syncUserProfile(auth.currentUser, clean);
    setUser({ ...auth.currentUser });
  };

  const updateUserPhoto = async (photoURL: string | null): Promise<void> => {
    if (!auth.currentUser) return;
    try {
      await updateProfile(auth.currentUser, { photoURL: photoURL || '' });
    } catch (e) {
      console.warn('Could not update Auth photoURL:', e);
    }
    try {
      const now = new Date().toISOString();
      await setDoc(
        doc(db, 'users', auth.currentUser.uid),
        {
          photoURL: photoURL || null,
          updatedAt: now,
        },
        { merge: true }
      );
      if (photoURL) {
        localStorage.setItem(`user_photo_${auth.currentUser.uid}`, photoURL);
      } else {
        localStorage.removeItem(`user_photo_${auth.currentUser.uid}`);
      }
    } catch (e) {
      console.warn('Could not save user photo to Firestore:', e);
    }
    setUser({ ...auth.currentUser, photoURL });
  };

  // Reauthenticate user before sensitive actions
  const reauthenticateUser = async (password?: string): Promise<void> => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Nenhum usuário autenticado.');

    const isGoogleUser = currentUser.providerData.some((p) => p.providerId === 'google.com');

    if (isGoogleUser) {
      await reauthenticateWithPopup(currentUser, googleProvider);
    } else {
      if (!password) {
        throw new Error('Digite sua senha atual para continuar.');
      }
      if (!currentUser.email) {
        throw new Error('E-mail do usuário indisponível.');
      }
      const credential = EmailAuthProvider.credential(currentUser.email, password);
      await reauthenticateWithCredential(currentUser, credential);
    }
  };

  // Change password with reauthentication
  const changeUserPassword = async (currentPassword: string, newPassword: string): Promise<void> => {
    setAuthError(null);
    try {
      await reauthenticateUser(currentPassword);
      if (!auth.currentUser) throw new Error('Sessão expirada.');
      await updatePassword(auth.currentUser, newPassword);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      const msg = mapAuthErrorMessage(code);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

async function deleteUserDataFromFirestore(uid: string, email?: string): Promise<void> {
  const subcollections = [
    'bills',
    'incomes',
    'expenses',
    'goals',
    'savings',
    'saving_transactions',
    'monthly_status',
    'categories',
    'accounts',
    'settings',
    'achievements',
    'finance_settings',
  ];

  for (const sub of subcollections) {
    try {
      const snap = await getDocs(collection(db, 'users', uid, sub));
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.forEach((docSnap) => {
          batch.delete(docSnap.ref);
        });
        await batch.commit();
      }
    } catch (err) {
      console.warn(`Error deleting subcollection ${sub} for user ${uid}:`, err);
    }
  }

  // Delete main user profile and directory lookup docs
  try {
    await deleteDoc(doc(db, 'users', uid));
    await deleteDoc(doc(db, 'user_directory', uid));
    if (email) {
      const emailHash = await hashEmail(email.toLowerCase().trim());
      await deleteDoc(doc(db, 'user_directory_lookup', emailHash));
    }
  } catch (err) {
    console.warn(`Error deleting directory docs for user ${uid}:`, err);
  }
}

  // Change email with reauthentication and verification link
  const changeUserEmail = async (currentPassword: string, newEmail: string): Promise<void> => {
    setAuthError(null);
    const cleanEmail = newEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Informe um endereço de e-mail válido.');
    }

    try {
      await reauthenticateUser(currentPassword);
      if (!auth.currentUser) throw new Error('Sessão expirada.');
      await verifyBeforeUpdateEmail(auth.currentUser, cleanEmail);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      const msg = mapAuthErrorMessage(code);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  // Delete user account with reauthentication and total Firestore data erasure
  const deleteUserAccount = async (password?: string): Promise<void> => {
    setAuthError(null);
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
      await reauthenticateUser(password);
      const uid = currentUser.uid;
      const email = currentUser.email || undefined;

      // Complete Firestore user data erasure before removing auth user
      await deleteUserDataFromFirestore(uid, email);

      await deleteUser(currentUser);
      setUser(null);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      const msg = mapAuthErrorMessage(code);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authError,
        oauthDiagnostics,
        clearAuthError,
        signUp,
        signIn,
        signInWithGoogle,
        resetPassword,
        signOutUser,
        sendVerificationEmail,
        reloadUser,
        updateDisplayName,
        updateUserPhoto,
        reauthenticateUser,
        changeUserPassword,
        changeUserEmail,
        deleteUserAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

