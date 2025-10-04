// app/src/screens/LoginScreen.tsx

import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useNavigation, StackActions } from '@react-navigation/native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

import { useAuth } from '../hooks/useAuth';
import { LoginDtoSchema, Dtos } from '../types/shared';
import { AppStyles } from '../styles';
import CustomInput from '../components/CustomInput';
import CustomButton from '../components/CustomButton';

const LoginScreen = () => {
  const navigation = useNavigation();
  const { login, loading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<Dtos.Login>({
    resolver: zodResolver(LoginDtoSchema),
    mode: 'onBlur',
    defaultValues: { email: '', password: '' },
  });

  const onLoginPress = async (data: Dtos.Login) => {
    try {
      const user = await login(data);
      Toast.show({ type: 'success', text1: `Welcome back, ${user.firstName}!` });
      
      // Advanced Navigation Flow: Check verification status
      if (!user.isIdentityVerified) {
        navigation.dispatch(StackActions.replace('VerificationGate'));
      } 
      // Conceptual: Check Onboarding status (if topInterests is empty)
      else if (user.topInterests.length === 0) { 
        navigation.dispatch(StackActions.replace('OnboardingQuiz'));
      } else {
        navigation.dispatch(StackActions.replace('Main'));
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Login failed. Check credentials/connection.';
      Toast.show({ type: 'error', text1: 'Login Failed', text2: errorMessage });
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={60}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Welcome Back!</Text>

        {/* Email Input */}
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <CustomInput
              placeholder="Email Address"
              onChangeText={onChange} onBlur={onBlur} value={value}
              error={errors.email?.message} keyboardType="email-address"
              autoCapitalize="none"
              icon={<Ionicons name="mail-outline" size={24} color={AppStyles.colors.gray} />}
              accessibilityLabel="Email Address"
            />
          )}
        />

        {/* Password Input (Min 12 chars enforced by Zod on registration) */}
        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <CustomInput
              placeholder="Password"
              onChangeText={onChange} onBlur={onBlur} value={value}
              error={errors.password?.message}
              secureTextEntry={!showPassword}
              icon={
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={24} color={AppStyles.colors.gray} />
                </TouchableOpacity>
              }
              accessibilityLabel="Password"
            />
          )}
        />

        <CustomButton
          title={loading ? 'Verifying Session...' : 'Log In Securely'}
          onPress={handleSubmit(onLoginPress)}
          disabled={!isValid || loading}
          style={styles.loginButton}
        />

        <TouchableOpacity onPress={() => navigation.navigate('VerificationGate' as any)} style={styles.forgotPassword}>
          <Text style={styles.linkText}>Trouble Logging In? Try Biometric ID</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* Social Login Placeholders */}
        <CustomButton
          title="Continue with Google"
          onPress={() => console.log('Google Login')}
          variant="secondary"
          icon={<Ionicons name="logo-google" size={20} color={AppStyles.colors.text} />}
        />

        <View style={styles.registerContainer}>
          <Text style={styles.registerText}>Don't have an account?</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register' as any)}>
            <Text style={styles.registerLink}>Sign Up</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppStyles.colors.background },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 25 },
  title: { fontSize: 32, fontWeight: 'bold', color: AppStyles.colors.primary, marginBottom: 30, textAlign: 'center' },
  loginButton: { marginTop: 20, marginBottom: 10 },
  forgotPassword: { textAlign: 'center', marginBottom: 30, fontSize: 14 },
  linkText: { color: AppStyles.colors.link, textAlign: 'center', fontSize: 14 },
  divider: { height: 1, backgroundColor: AppStyles.colors.lightGray, marginVertical: 20 },
  registerContainer: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  registerText: { fontSize: 16, color: AppStyles.colors.text, marginRight: 5 },
  registerLink: { fontSize: 16, color: AppStyles.colors.primary, fontWeight: 'bold' },
});

export default LoginScreen;