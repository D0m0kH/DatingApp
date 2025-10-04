// app/src/screens/RegisterScreen.tsx

import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useNavigation, StackActions } from '@react-navigation/native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

import { useAuth } from '../hooks/useAuth';
import { RegisterDtoSchema, Dtos } from '../types/shared';
import { AppStyles } from '../styles';
import CustomInput from '../components/CustomInput';
import CustomButton from '../components/CustomButton';
import CustomPicker from '../components/CustomPicker';

const GENDERS = ['Female', 'Male', 'Non-Binary', 'Other'];
const ORIENTATIONS = ['Straight', 'Gay', 'Lesbian', 'Bisexual', 'Pansexual', 'Asexual', 'Other'];

const RegisterScreen = () => {
  const navigation = useNavigation();
  const { register, loading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<Dtos.Register>({
    resolver: zodResolver(RegisterDtoSchema), // Enforces minimum 12 char password
    mode: 'onBlur',
    defaultValues: {
      email: '', password: '', firstName: '', dateOfBirth: '', gender: '', orientation: '',
    },
  });

  const onRegisterPress = async (data: Dtos.Register) => {
    // Client-side age check
    const dob = new Date(data.dateOfBirth);
    const age = Math.abs(new Date(Date.now() - dob.getTime()).getUTCFullYear() - 1970);
    if (age < 18) {
        return Toast.show({ type: 'error', text1: 'Age Restriction', text2: 'You must be at least 18 years old.' });
    }

    try {
      await register(data);
      Toast.show({ type: 'success', text1: 'Registration Successful!', text2: 'Next: Tell us about your preferences.' });
      
      // Advanced Navigation: Move to Onboarding Quiz immediately to capture AI vectors
      navigation.dispatch(StackActions.replace('OnboardingQuiz'));
    } catch (error: any) {
      const errorMessage = error.message || 'Registration failed.';
      Toast.show({ type: 'error', text1: 'Registration Failed', text2: errorMessage });
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={60}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Create Secure Account</Text>
        <Text style={styles.subtitle}>12+ character password required for security.</Text>

        {/* ... (Input fields for firstName, email, password, dateOfBirth, gender, orientation remain similar) ... */}
        {/* First Name */}
        <Controller
          control={control} name="firstName"
          render={({ field: { onChange, onBlur, value } }) => (
            <CustomInput placeholder="First Name" onChangeText={onChange} onBlur={onBlur} value={value} error={errors.firstName?.message} icon={<Ionicons name="person-outline" size={24} color={AppStyles.colors.gray} />} />
          )}
        />
        {/* Email Input */}
        <Controller
          control={control} name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <CustomInput placeholder="Email Address" onChangeText={onChange} onBlur={onBlur} value={value} error={errors.email?.message} keyboardType="email-address" autoCapitalize="none" icon={<Ionicons name="mail-outline" size={24} color={AppStyles.colors.gray} />} />
          )}
        />
        {/* Password Input */}
        <Controller
          control={control} name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <CustomInput
              placeholder="Password (Min 12 characters)" onChangeText={onChange} onBlur={onBlur} value={value} error={errors.password?.message} secureTextEntry={!showPassword}
              icon={
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={24} color={AppStyles.colors.gray} />
                </TouchableOpacity>
              }
            />
          )}
        />
        {/* Date of Birth */}
        <Controller
          control={control} name="dateOfBirth"
          render={({ field: { onChange, value } }) => (
            <CustomInput placeholder="Date of Birth (YYYY-MM-DD)" onChangeText={onChange} value={value} error={errors.dateOfBirth?.message} keyboardType="numbers-and-punctuation" icon={<Ionicons name="calendar-outline" size={24} color={AppStyles.colors.gray} />} />
          )}
        />
        {/* Gender Picker */}
        <Controller
            control={control} name="gender"
            render={({ field: { onChange, value } }) => (
                <CustomPicker placeholder="Select Gender" items={GENDERS.map(g => ({ label: g, value: g }))} selectedValue={value} onValueChange={onChange} error={errors.gender?.message} />
            )}
        />
        {/* Orientation Picker */}
        <Controller
            control={control} name="orientation"
            render={({ field: { onChange, value } }) => (
                <CustomPicker placeholder="Select Orientation" items={ORIENTATIONS.map(o => ({ label: o, value: o }))} selectedValue={value} onValueChange={onChange} error={errors.orientation?.message} />
            )}
        />

        <CustomButton
          title={loading ? 'Creating FASE Session...' : 'Sign Up & Continue'}
          onPress={handleSubmit(onRegisterPress)}
          disabled={!isValid || loading}
          style={styles.registerButton}
        />

        <View style={styles.registerContainer}>
          <Text style={styles.loginText}>Already have an account?</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login' as any)}>
            <Text style={styles.loginLink}>Log In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppStyles.colors.background },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 25 },
  title: { fontSize: 32, fontWeight: 'bold', color: AppStyles.colors.primary, marginBottom: 5, textAlign: 'center' },
  subtitle: { fontSize: 14, color: AppStyles.colors.gray, marginBottom: 25, textAlign: 'center' },
  registerButton: { marginTop: 20, marginBottom: 10 },
  registerContainer: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  loginText: { fontSize: 16, color: AppStyles.colors.text, marginRight: 5 },
  loginLink: { fontSize: 16, color: AppStyles.colors.primary, fontWeight: 'bold' },
});

export default RegisterScreen;