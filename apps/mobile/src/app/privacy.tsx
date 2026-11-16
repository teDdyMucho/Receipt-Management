import React from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, space } from '../lib/theme';

// Public page: https://<server>/privacy. No sign in needed. This is the address
// given to Apple and Google as the app's privacy policy.
const UPDATED = 'November 17, 2026';

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: 'Who this app is for',
    body: [
      'Lionrock is the receipt app of Lion Rock Property Management. It is used by our employees and by vendors who work with us. It is not meant for the general public and it has no advertising.',
    ],
  },
  {
    title: 'What we collect',
    body: [
      'Your account: the link name you sign in with, or your staff name and email address. Your PIN or password is stored only as a scrambled value that cannot be read back.',
      'Your profile picture, if you choose to add one.',
      'The receipts you upload: the photo or PDF, and the details that go with it (date, total, work order, property address and type).',
      'A record of actions on receipts: who uploaded, edited or deleted a receipt, and when.',
      'Basic device information: a random id for the phone, the app version and whether it is an iPhone or Android phone. This helps us solve upload problems.',
    ],
  },
  {
    title: 'What we do not collect',
    body: ['We do not collect your location, your contacts, or anything from your photo library except the pictures you choose yourself. We do not track you across other apps or websites.'],
  },
  {
    title: 'How we use it',
    body: [
      'To keep the receipts of Lion Rock Property Management: so the office can review them, match them to work orders and keep its records.',
      'To read a receipt for you. When you upload a receipt, its picture is sent to an AI service (OpenAI) that reads the date, total, work order and address so you do not have to type them. It is used only for that.',
    ],
  },
  {
    title: 'Who can see it',
    body: [
      'You see your own receipts. Office staff of Lion Rock Property Management can see the receipts of everyone who uses the app.',
      'We do not sell your information and we do not share it for advertising. It is stored with our hosting and database providers (Expo and Supabase), who keep it on our behalf.',
    ],
  },
  {
    title: 'How long we keep it',
    body: [
      'Receipts are business records, so they are kept for as long as Lion Rock Property Management needs them for its accounts. A receipt you delete in the app is removed from the app right away; the office may keep its record of it.',
    ],
  },
  {
    title: 'Your choices',
    body: [
      'You can change your profile picture and your PIN in Settings. To have your account closed or your information removed, ask the Lion Rock Property Management office.',
      'The app asks for the camera only to photograph receipts, and for your photos only when you choose a picture.',
    ],
  },
  {
    title: 'Contact',
    body: ['Questions about this policy: contact the Lion Rock Property Management office, or use the Support link on the app’s store page.'],
  },
];

export default function Privacy() {
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Image source={require('../../assets/logo.png')} style={styles.logo} accessibilityLabel="Lion Rock logo" />
        <Text style={styles.title} accessibilityRole="header">
          Privacy Policy
        </Text>
        <Text style={styles.updated}>Lionrock · Lion Rock Property Management · Last updated {UPDATED}</Text>
        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.heading} accessibilityRole="header">
              {section.title}
            </Text>
            {section.body.map((paragraph) => (
              <Text key={paragraph} style={styles.text}>
                {paragraph}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.xl, gap: space.lg },
  logo: { width: 64, height: 64 },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  updated: { fontSize: 13, color: colors.muted, marginTop: -space.md },
  section: { gap: space.sm },
  heading: { fontSize: 17, fontWeight: '700', color: colors.text },
  text: { fontSize: 15, lineHeight: 23, color: colors.text },
});
