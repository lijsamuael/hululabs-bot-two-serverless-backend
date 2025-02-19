interface BaseStats {
    store_id: string;
    user_tg_id: string;
  }
  
  export interface ViewStats extends BaseStats {
    product_sku: string;
  }
  
  export interface OrderStats extends BaseStats {
    order_number: string;
  }
  
  type StatType = 'visit' | 'view' | 'order';
  
  export interface StatisticsRequest {
    type: StatType;
    data: BaseStats | ViewStats[] | (OrderStats & BaseStats);
  }