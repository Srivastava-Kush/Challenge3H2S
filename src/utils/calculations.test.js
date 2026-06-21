import { describe, it, expect } from 'vitest';
import { calcEmissions, calcDailyEmissions, validateForm, validateDailyForm } from './calculations';

describe('Calculations Utilities', () => {
  describe('calcEmissions (Monthly)', () => {
    it('should calculate monthly emissions correctly with default state', () => {
      const form = {
        electricity: '100',
        lpg: '1',
        km: '200',
        vehicle: 'petrolBike',
        diet: 'veg',
        smartphone: '4',
        laptop: '6',
        state: ''
      };
      const result = calcEmissions(form);
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('electricity');
      expect(result.electricity).toBeGreaterThan(0);
      expect(result.lpg).toBeGreaterThan(0);
      expect(result.total).toBeGreaterThan(0);
      expect(result.gridFactor).toBeDefined();
    });

    it('should handle zero inputs properly', () => {
      const form = {
        electricity: '0', lpg: '0', km: '0', vehicle: 'petrolBike', diet: 'veg', smartphone: '0', laptop: '0', state: ''
      };
      const result = calcEmissions(form);
      expect(result.electricity).toBe(0);
      expect(result.lpg).toBe(0);
      expect(result.transport).toBe(0);
    });
  });

  describe('calcDailyEmissions (Daily)', () => {
    it('should calculate daily emissions correctly', () => {
      const form = {
        electricity: '10',
        km: '20',
        vehicle: 'petrolBike',
        diet: 'nonveg',
        smartphone: '4',
        laptop: '4',
        state: 'Maharashtra'
      };
      const result = calcDailyEmissions(form);
      expect(result).toHaveProperty('total');
      expect(result.lpg).toBe(0); // Daily ignores LPG
      expect(result.electricity).toBeGreaterThan(0);
    });
  });

  describe('Form Validation', () => {
    it('validateForm should return errors for invalid values', () => {
      const form = { electricity: '-10', lpg: '30', km: '20000', smartphone: '25', laptop: '20' };
      const errors = validateForm(form);
      expect(errors.electricity).toMatch(/cannot be negative/);
      expect(errors.lpg).toMatch(/seems too high/);
      expect(errors.km).toMatch(/seems too high/);
      expect(errors.smartphone).toMatch(/seems too high/);
    });

    it('validateForm should catch combined screen time over 24 hours', () => {
      const form = { electricity: '100', lpg: '1', km: '100', smartphone: '15', laptop: '12' };
      const errors = validateForm(form);
      expect(errors.laptop).toMatch(/Combined screen time cannot exceed 24 hrs\/day/);
    });

    it('validateDailyForm should validate correct maximums', () => {
      const form = { electricity: '150', km: '1200', smartphone: '4', laptop: '4' };
      const errors = validateDailyForm(form);
      expect(errors.electricity).toMatch(/seems too high/);
      expect(errors.km).toMatch(/seems too high/);
    });
  });
});
