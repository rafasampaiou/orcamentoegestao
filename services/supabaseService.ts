import { supabase } from './supabaseClient';
import { Account, CostCenter, Hotel, BudgetVersion, Profile } from '../types';

export const supabaseService = {
  // ─── ACCOUNTS ────────────────────────────────────────────────────────────────
  async getAccounts(): Promise<Account[]> {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .order('sortOrder', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  // ─── COST CENTERS ─────────────────────────────────────────────────────────
  async getCostCenters(): Promise<CostCenter[]> {
    const { data, error } = await supabase
      .from('cost_centers')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  // ─── HOTELS ───────────────────────────────────────────────────────────────
  async getHotels(): Promise<Hotel[]> {
    const { data, error } = await supabase
      .from('hotels')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  // ─── BUDGET DATA ──────────────────────────────────────────────────────────
  async getBudgetData(accountId: string, costCenterId: string, year: number): Promise<number[]> {
    const { data, error } = await supabase
      .from('budget_data')
      .select('month, value')
      .eq('account_id', accountId)
      .eq('cost_center_id', costCenterId)
      .eq('year', year);
    if (error) throw error;

    const values = Array(12).fill(0);
    data?.forEach(row => {
      if (row.month >= 1 && row.month <= 12) {
        values[row.month - 1] = row.value;
      }
    });
    return values;
  },

  async saveBudgetData(accountId: string, costCenterId: string, year: number, values: number[]) {
    const records = values.map((val, idx) => ({
      account_id: accountId,
      cost_center_id: costCenterId,
      year: year,
      month: idx + 1,
      value: val,
      updated_at: new Date().toISOString()
    }));

    const { error } = await supabase
      .from('budget_data')
      .upsert(records, { onConflict: 'account_id,cost_center_id,year,month' });
    if (error) throw error;
  },

  // ─── BUDGET VERSIONS ───────────────────────────────────────────────────────
  async getBudgetVersions(): Promise<BudgetVersion[]> {
    const { data, error } = await supabase
      .from('budget_versions')
      .select('*')
      .order('year', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  // ─── PROFILES (USER MANAGEMENT) ────────────────────────────────────────────

  /** Fetch all user profiles */
  async getProfiles(): Promise<Profile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name', { ascending: true });
    if (error) throw error;
    return (data || []) as Profile[];
  },

  /** Create or update a profile (upsert by id) */
  async upsertProfile(profile: Partial<Profile> & { id: string }): Promise<Profile> {
    const { data, error } = await supabase
      .from('profiles')
      .upsert({ ...profile, updated_at: new Date().toISOString() }, { onConflict: 'id' })
      .select()
      .single();
    if (error) throw error;
    return data as Profile;
  },

  /** Delete a profile by id */
  async deleteProfile(id: string): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  /** Get the profile for the currently authenticated user */
  async getCurrentProfile(): Promise<Profile | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (error) return null;
    return data as Profile;
  },
};
