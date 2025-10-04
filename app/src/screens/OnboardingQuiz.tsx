// app/src/screens/OnboardingQuiz.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ProgressViewIOS, Platform } from 'react-native';
import { useNavigation, StackActions } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

import { AppStyles } from '../styles';
import CustomButton from '../components/CustomButton';
import { post } from '../services/api';
import { useAuth } from '../hooks/useAuth';

// --- Static Advanced Quiz Data ---
const QUIZ_STEPS = [
  {
    key: 'personality',
    title: 'Core Personality (The Big Five)',
    microcopy: 'We start with your core personality. On a scale of 1 to 5, how much do you agree with this statement?',
    questions: [
      { id: 'extroversion', text: 'I see myself as extraverted, enthusiastic.' },
      { id: 'neuroticism', text: 'I worry a lot about the future.' },
      { id: 'conscientiousness', text: 'I like things to be organized and follow routines.' },
    ],
  },
  {
    key: 'values',
    title: 'Core Values & Lifestyle',
    microcopy: 'Next, let’s explore what truly matters to you in life and a partner.',
    questions: [
      { id: 'adventure', text: 'I value adventure and spontaneous trips over stability.' },
      { id: 'intellect', text: 'Intellectual curiosity is more important than emotional stability.' },
      { id: 'social', text: 'My social life dictates most of my weekend plans.' },
    ],
  },
];

const ANSWERS_OPTIONS = [
  { label: 'Strongly Disagree', value: 1 },
  { label: 'Disagree', value: 2 },
  { label: 'Neutral', value: 3 },
  { label: 'Agree', value: 4 },
  { label: 'Strongly Agree', value: 5 },
];

const STORAGE_KEY = '@OnboardingQuizProgress';

// --- Component ---
const OnboardingQuiz = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  const questionsInCurrentStep = QUIZ_STEPS[currentStep].questions.length;
  const answeredInCurrentStep = QUIZ_STEPS[currentStep].questions.filter(q => answers[q.id] !== undefined).length;
  const isStepComplete = answeredInCurrentStep === questionsInCurrentStep;

  // ... (Load/Save progress logic remains similar) ...

  const handleAnswer = useCallback((questionId: string, value: number) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  }, []);

  const handleNext = () => {
    if (!isStepComplete) {
      return Toast.show({ type: 'error', text1: 'Please answer all questions in this step.' });
    }

    if (currentStep < QUIZ_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleSubmitQuiz();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmitQuiz = async () => {
    setLoading(true);

    // 1. Map answers to Multi-Vector payload
    const traitAnswers = QUIZ_STEPS.find(s => s.key === 'personality')?.questions.map(q => ({
        id: q.id,
        answer: answers[q.id],
    }));
    const valueAnswers = QUIZ_STEPS.find(s => s.key === 'values')?.questions.map(q => ({
        id: q.id,
        answer: answers[q.id],
    }));

    try {
        // 2. POST answers to dedicated processing endpoint
        await post('/profile/quiz/compute-vectors', {
            traitAnswers,
            valueAnswers,
            // Client location/context could also be sent here
        });

        // 3. Clear local storage
        await AsyncStorage.removeItem(STORAGE_KEY);

        Toast.show({
            type: 'success',
            text1: 'AI Engine Initialized!',
            text2: 'Now proceed to Identity Verification to start matching.',
        });

        // 4. Navigate to Verification Gate
        navigation.dispatch(StackActions.replace('VerificationGate'));

    } catch (error: any) {
        Alert.alert('Submission Failed', error.message || 'Could not save your quiz data. Please try again.');
    } finally {
        setLoading(false);
    }
  };

  const stepData = QUIZ_STEPS[currentStep];
  const progress = (currentStep + 1) / QUIZ_STEPS.length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.progressText}>{`Step ${currentStep + 1} of ${QUIZ_STEPS.length}: ${stepData.title}`}</Text>
        {Platform.OS === 'ios' ? (
          <ProgressViewIOS style={styles.progressBar} progress={progress} progressTintColor={AppStyles.colors.primary} />
        ) : (
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBarAndroid, { width: `${progress * 100}%` }]} />
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.microcopy}>{stepData.microcopy}</Text>

        {stepData.questions.map(question => (
          <View key={question.id} style={styles.questionCard}>
            <Text style={styles.questionText}>{question.text}</Text>
            <View style={styles.answerOptions}>
              {ANSWERS_OPTIONS.map(option => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.answerButton,
                    answers[question.id] === option.value && styles.answerButtonActive,
                  ]}
                  onPress={() => handleAnswer(question.id, option.value)}
                >
                  <Text style={[
                    styles.answerButtonText,
                    answers[question.id] === option.value && styles.answerButtonTextActive,
                  ]}>
                    {option.label.substring(0, 8)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <CustomButton
          title="Back"
          onPress={handleBack}
          disabled={currentStep === 0 || loading}
          variant="tertiary"
          style={styles.footerButton}
        />
        <CustomButton
          title={currentStep === QUIZ_STEPS.length - 1 ? (loading ? 'Analyzing...' : 'Finish & Verify') : 'Next'}
          onPress={handleNext}
          disabled={!isStepComplete || loading}
          style={[styles.footerButton, styles.nextButton]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppStyles.colors.background },
  header: { paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 50 : 20, paddingBottom: 15, backgroundColor: AppStyles.colors.white, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: AppStyles.colors.lightGray },
  progressText: { fontSize: 14, color: AppStyles.colors.gray, marginBottom: 10 },
  progressBar: { transform: [{ scaleX: 1.0 }, { scaleY: 2.0 }] },
  progressBarContainer: { height: 4, borderRadius: 2, backgroundColor: AppStyles.colors.lightGray, overflow: 'hidden' },
  progressBarAndroid: { height: '100%', backgroundColor: AppStyles.colors.primary },
  scrollContent: { padding: 20 },
  microcopy: { fontSize: 16, color: AppStyles.colors.text, marginBottom: 20, fontStyle: 'italic' },
  questionCard: { backgroundColor: AppStyles.colors.white, borderRadius: 12, padding: 20, marginBottom: 25, shadowColor: AppStyles.colors.black, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3.84, elevation: 5 },
  questionText: { fontSize: 18, fontWeight: '600', color: AppStyles.colors.text, marginBottom: 15 },
  answerOptions: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' },
  answerButton: { backgroundColor: AppStyles.colors.lightGray, paddingVertical: 10, paddingHorizontal: 6, borderRadius: 8, marginVertical: 4, width: '18%', alignItems: 'center' }, // Adjusted width for 5 options
  answerButtonActive: { backgroundColor: AppStyles.colors.primary, borderColor: AppStyles.colors.primary, borderWidth: 1 },
  answerButtonText: { fontSize: 11, fontWeight: '500', color: AppStyles.colors.text, textAlign: 'center' },
  answerButtonTextActive: { color: AppStyles.colors.white },
  footer: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: AppStyles.colors.lightGray, backgroundColor: AppStyles.colors.white },
  footerButton: { width: '48%' },
  nextButton: { backgroundColor: AppStyles.colors.primary },
});

export default OnboardingQuiz;