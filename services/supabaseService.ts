import { supabase } from './supabaseClient';
import { Account, CostCenter, Hotel, BudgetVersion } from '../types';

export const supabaseService = {
  // Fetch all accounts
  async getAccounts(): Promise<Account[]> {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .order('sortOrder', { ascending: true });
    
    if (error) throw error;
    return data || [];
  },

  // Fetch all cost centers (Setores)
  async getCostCenters(): Promise<CostCenter[]> {
    const { data, error } = await supabase
      .from('cost_centers')
      .select('*')
      .order('name', { ascending: true });
    
    if (error) throw error;
    return data || [];
  },

  // Fetch all hotels
  async getHotels(): Promise<Hotel[]> {
    const { data, error } = await supabase
      .from('hotels')
      .select('*')
      .order('name', { ascending: true });
    
    if (error) throw error;
    return data || [];
  },

  // Fetch budget values for a specific account, cost center and year
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

  // Save budget values
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

  // Fetch budget versions
  async getBudgetVersions(): Promise<BudgetVersion[]> {
    const { data, error } = await supabase
      .from('budget_versions')
      .select('*')
      .order('year', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }
};
