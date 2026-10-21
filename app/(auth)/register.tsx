import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AreaField } from '@/components/AreaPicker';
import { AuthHero } from '@/components/AuthHero';
import { AppText, Button, Header, Screen, TextField } from '@/components/ui';
import { auth, toApiError } from '@/services';
import { useAuth } from '@/store/AuthContext';
import { useToast } from '@/store/ToastContext';
import { colors, radius, spacing } from '@/theme';
import { haptic } from '@/utils/haptics';
import { homeFor } from '@/utils/routes';
import {
  passwordStrength,
  required,
  validateEmail,
  validateForm,
  validateName,
  validatePassword,
  validatePhone,
} from '@/utils/validation';

type AccountType = 'customer' | 'seller';
type Step = 'type' | 'details' | 'shop' | 'verify';

const ROLE_CARDS: { type: AccountType; icon: keyof typeof Ionicons.glyphMap; title: string; body: string }[] = [
  { type: 'customer', icon: 'basket-outline', title: 'I want to buy', body: 'Order fresh produce from mama mbogas near me' },
  { type: 'seller', icon: 'storefront-outline', title: 'I sell produce', body: 'Run my mama mboga business, take orders and track sales' },
];

export default function Register() {
  const { signUp, verifySignUp } = useAuth();
  const toast = useToast();
  const [step, setStep] = useState<Step>('type');
  const [verifyEmail, setVerifyEmail] = useState('');
  const [code, setCode] = useState('');
  const [type, setType] = useState<AccountType>('customer');
  const [v, setV] = useState({ fullName: '', phone: '', email: '', password: '', confirm: '', area: '', businessName: '', addressLine: '', landmark: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof v | 'form' | 'terms' | 'code', string>>>({});
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof v) => (text: string) => {
    setV((p) => ({ ...p, [k]: text }));
    setErrors((e) => ({ ...e, [k]: undefined, form: undefined }));
  };

  const strength = passwordStrength(v.password);
  const isSeller = type === 'seller';

  const validateDetails = () => {
    const e = validateForm(v, {
      fullName: validateName,
      phone: validatePhone,
      email: validateEmail,
      password: validatePassword,
      area: required('Area'),
    });
    if (v.confirm !== v.password) e.confirm = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!agreed) {
      setErrors((e) => ({ ...e, terms: 'Please accept the terms to continue' }));
      return;
    }
    if (isSeller) {
      const e = validateForm(v, { businessName: required('Business name'), addressLine: required('Stall / shop location') });
      if (Object.keys(e).length) return setErrors(e);
    }
    setBusy(true);
    try {
      const outcome = await signUp({
        role: type,
        fullName: v.fullName,
        phone: v.phone,
        email: v.email,
        password: v.password,
        area: v.area,
        shop: isSeller ? { businessName: v.businessName, addressLine: v.addressLine, landmark: v.landmark } : undefined,
      });
      if ('verifyEmail' in outcome) {
        setVerifyEmail(outcome.verifyEmail);
        setStep('verify');
        return;
      }
      haptic.success();
      router.replace(homeFor(outcome.user.role) as never);
    } catch (err) {
      const e = toApiError(err);
      haptic.error();
      // Send field errors back to the step that owns the field.
      if (e.field && ['fullName', 'phone', 'email', 'password'].includes(e.field)) setStep('details');
      setErrors(e.field ? { [e.field]: e.message } : { form: e.message });
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!/^\d{6}$/.test(code)) return setErrors({ code: 'Enter the 6-digit code' });
    setBusy(true);
    try {
      const user = await verifySignUp(verifyEmail, code);
      haptic.success();
      router.replace(homeFor(user.role) as never);
    } catch (err) {
      haptic.error();
      setErrors({ code: toApiError(err).message });
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    try {
      await auth.resendSignupCode(verifyEmail);
      toast.show('A new code has been sent', 'success');
    } catch (err) {
      toast.show(toApiError(err).message, 'error');
    }
  };

  const back = () =>
    step === 'verify' ? setStep(isSeller ? 'shop' : 'details') : step === 'shop' ? setStep('details') : step === 'details' ? setStep('type') : router.back();
  const totalSteps = isSeller ? 4 : 3;
  const stepNo = step === 'type' ? 1 : step === 'details' ? 2 : step === 'shop' ? 3 : totalSteps;

  const footer =
    step === 'verify' ? (
      <Button title="Verify and continue" size="lg" fullWidth loading={busy} onPress={verify} />
    ) : step === 'type' ? (
      <Button title="Continue" size="lg" fullWidth iconRight="arrow-forward" onPress={() => setStep('details')} />
    ) : step === 'details' && isSeller ? (
      <Button title="Continue" size="lg" fullWidth iconRight="arrow-forward" onPress={() => validateDetails() && setStep('shop')} />
    ) : (
      <Button title="Create account" size="lg" fullWidth loading={busy} onPress={() => (step === 'details' ? validateDetails() && submit() : submit())} />
    );

  const terms = (
    <>
      <Pressable style={styles.terms} onPress={() => { setAgreed((a) => !a); setErrors((e) => ({ ...e, terms: undefined })); }} accessibilityRole="checkbox" accessibilityState={{ checked: agreed }}>
        <View style={[styles.box, agreed && styles.boxOn]}>{agreed && <Ionicons name="checkmark" size={16} color={colors.white} />}</View>
        <AppText variant="small" style={{ flex: 1 }}>
          I agree to the Mama Mboga Terms of Service and Privacy Policy, and consent to my data being used to process my orders.
        </AppText>
      </Pressable>
      {!!errors.terms && <AppText variant="small" color={colors.danger}>{errors.terms}</AppText>}
    </>
  );

  return (
    <Screen keyboard header={<Header onBack={back} subtitle={`Step ${stepNo} of ${totalSteps}`} />} footer={footer}>
      <View style={styles.progress}>
        {Array.from({ length: totalSteps }).map((_, i) => (
          <View key={i} style={[styles.bar, i < stepNo && { backgroundColor: colors.primary }]} />
        ))}
      </View>

      {!!errors.form && (
        <View style={styles.formError} accessibilityRole="alert">
          <Ionicons name="alert-circle" size={20} color={colors.danger} />
          <AppText variant="small" color={colors.danger} style={{ flex: 1 }}>{errors.form}</AppText>
        </View>
      )}

      {step === 'type' && (
        <>
          <AuthHero title="Create your account" subtitle="How will you use Mama Mboga?" />
          {ROLE_CARDS.map((c) => {
            const on = type === c.type;
            return (
              <Pressable
                key={c.type}
                onPress={() => { haptic.tap(); setType(c.type); }}
                style={[styles.roleCard, on && styles.roleOn]}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
              >
                <View style={[styles.roleIcon, on && { backgroundColor: colors.primary }]}>
                  <Ionicons name={c.icon} size={26} color={on ? colors.white : colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="h3">{c.title}</AppText>
                  <AppText variant="small">{c.body}</AppText>
                </View>
                <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={24} color={on ? colors.primary : colors.textMuted} />
              </Pressable>
            );
          })}
          <View style={styles.footerLink}>
            <AppText variant="body">Already have an account?</AppText>
            <Link href="/login" replace asChild>
              <Pressable hitSlop={8} accessibilityRole="link">
                <AppText variant="bodyStrong" color={colors.primary}>Sign in</AppText>
              </Pressable>
            </Link>
          </View>
        </>
      )}

      {step === 'details' && (
        <>
          <AppText variant="h1" style={styles.title}>Your details</AppText>
          <TextField label="Full name" placeholder="e.g. Grace Wanjiku" icon="person-outline" value={v.fullName} onChangeText={set('fullName')} error={errors.fullName} autoComplete="name" textContentType="name" autoCapitalize="words" />
          <TextField label="Phone number" placeholder="0712 345 678" icon="call-outline" value={v.phone} onChangeText={set('phone')} error={errors.phone} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" hint="Sellers and riders use this to reach you" />
          <TextField label="Email address" placeholder="you@example.com" icon="mail-outline" value={v.email} onChangeText={set('email')} error={errors.email} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
          <AreaField value={v.area} onChange={set('area')} error={errors.area} label={isSeller ? 'Where is your business?' : 'Where do you live?'} />
          <TextField label="Password" placeholder="At least 8 characters" icon="lock-closed-outline" password value={v.password} onChangeText={set('password')} error={errors.password} autoComplete="new-password" textContentType="newPassword" />
          {!!v.password && (
            <View style={styles.strength}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={[styles.strengthBar, i < strength.score && { backgroundColor: [colors.danger, colors.warning, colors.success][strength.score - 1] }]} />
              ))}
              <AppText variant="caption" style={{ width: 64, textAlign: 'right' }}>{strength.label}</AppText>
            </View>
          )}
          <TextField label="Confirm password" placeholder="Type it again" icon="lock-closed-outline" password value={v.confirm} onChangeText={set('confirm')} error={errors.confirm} autoComplete="new-password" />
          {!isSeller && terms}
        </>
      )}

      {step === 'shop' && (
        <>
          <AppText variant="h1" style={styles.title}>Your business</AppText>
          <AppText variant="body" style={{ marginBottom: spacing.xl }}>
            This is what customers will see. You can add photos, hours and delivery details later.
          </AppText>
          <TextField label="Business name" placeholder="e.g. Mama Wanjiku Fresh Greens" icon="storefront-outline" value={v.businessName} onChangeText={set('businessName')} error={errors.businessName} autoCapitalize="words" />
          <TextField label="Stall / shop location" placeholder="e.g. Stall 14, Adams Arcade Market" icon="navigate-outline" value={v.addressLine} onChangeText={set('addressLine')} error={errors.addressLine} />
          <TextField label="Nearby landmark" optional placeholder="e.g. Next to the matatu stage" icon="flag-outline" value={v.landmark} onChangeText={set('landmark')} />
          {terms}
        </>
      )}

      {step === 'verify' && (
        <>
          <View style={styles.verifyIcon}>
            <Ionicons name="mail-unread-outline" size={30} color={colors.primary} />
          </View>
          <AppText variant="h1">Check your email</AppText>
          <AppText variant="body" style={{ marginTop: spacing.sm, marginBottom: spacing.xxl }}>
            We sent a 6-digit code to {verifyEmail}. Enter it below to activate your account. Check your spam folder if you can't find it.
          </AppText>
          <TextField
            label="6-digit code"
            icon="keypad-outline"
            placeholder="123456"
            value={code}
            onChangeText={(t) => { setCode(t.replace(/\D/g, '').slice(0, 6)); setErrors({}); }}
            error={errors.code}
            keyboardType="number-pad"
            maxLength={6}
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            returnKeyType="go"
            onSubmitEditing={verify}
          />
          <Button title="Resend code" variant="ghost" onPress={resend} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  progress: { flexDirection: 'row', gap: 6, marginBottom: spacing.sm },
  verifyIcon: { width: 64, height: 64, borderRadius: radius.lg, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg, marginBottom: spacing.lg },
  bar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border },
  title: { marginTop: spacing.lg, marginBottom: spacing.lg },
  formError: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', backgroundColor: colors.dangerLight, padding: spacing.md, borderRadius: radius.md, marginTop: spacing.md },
  roleCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.card, marginBottom: spacing.md },
  roleOn: { borderColor: colors.primary, backgroundColor: '#F4FBF7' },
  roleIcon: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  footerLink: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: spacing.xxl },
  strength: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -spacing.sm, marginBottom: spacing.lg },
  strengthBar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border },
  terms: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start', marginTop: spacing.sm, marginBottom: spacing.sm },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
});
