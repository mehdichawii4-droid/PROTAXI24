import { forwardRef, useImperativeHandle } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  CourseTrackingMapProps,
  CourseTrackingMapRef,
} from './CourseTrackingMap.types';

const CourseTrackingMap = forwardRef<CourseTrackingMapRef, CourseTrackingMapProps>(
  function CourseTrackingMap({ mapStyle }, ref) {
    useImperativeHandle(ref, () => ({
      animateCamera: () => {},
    }));

    return (
      <View style={[styles.container, mapStyle]}>
        <Text style={styles.text}>Suivi GPS indisponible sur Web</Text>
      </View>
    );
  }
);

export default CourseTrackingMap;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111',
  },
  text: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
});
