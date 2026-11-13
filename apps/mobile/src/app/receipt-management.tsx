import { Redirect, useLocalSearchParams } from 'expo-router';
import React from 'react';

// Handles links of the form .../receipt-management?access=NAME: the welcome
// screen verifies that NAME without any typing.
export default function AccessLink() {
  const { access } = useLocalSearchParams<{ access?: string }>();
  return <Redirect href={{ pathname: '/welcome', params: access ? { access } : {} }} />;
}
