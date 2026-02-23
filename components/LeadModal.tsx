
import React, { useState, useEffect, useRef } from 'react';
import { Lead, Platform, ContactStatus, LeadStatus, Role, ProgressUpdate, ChangeHistory, CostRecord, ProfitRecord } from '../types';
import { CONTACT_STATUS_OPTIONS, PLATFORM_OPTIONS, DEFAULT_COST_ITEMS } from '../constants';
import { X, Upload, Sparkles, User, Loader2, Info, Plus, MessageSquare, Calendar, History, TrendingUp, Camera, Link as LinkIcon, Image as ImageIcon, DollarSign, TrendingDown, FileText } from 'lucide-react';
import { extractLeadFromImage } from '../services/aiService';
import { addProgressUpdate, addCostRecord, deleteCostRecord, addProfitRecord, deleteProfitRecord } from '../services/leadService';

interface LeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<Lead>) => void;
  initialData?: Lead | null;
  userRole: Role;
  userName: string;
}

const LeadModal: React.FC<LeadModalProps> = ({ isOpen, onClose, onSubmit, initialData: propInitialData, userRole, userName }) => {
  // 使用內部狀態來管理 initialData，這樣可以在添加進度更新後立即更新
  const [initialData, setInitialData] = useState<Lead | null>(propInitialData || null);
  
  // 當 propInitialData 改變時，更新內部狀態
  // 但只在 Modal 剛打開或切換到不同案件時才更新，避免覆蓋掉部分更新（如進度更新、成本記錄等）
  useEffect(() => {
    const isModalJustOpened = !prevIsOpenRef.current && isOpen;
    const isDifferentLead = prevInitialDataIdRef.current !== (propInitialData?.id || null);
    
    // 只在 Modal 剛打開或切換到不同案件時才更新 initialData
    if (isModalJustOpened || isDifferentLead) {
      setInitialData(propInitialData || null);
    } else if (propInitialData && initialData?.id === propInitialData.id) {
      // 如果是同一個案件，但 propInitialData 有更新（例如從父組件傳入的更新），則合併更新
      // 但優先保留本地已更新的部分（如 cost_records、profit_records、progress_updates）
      setInitialData(prev => {
        if (!prev) return propInitialData;
        // 合併更新，但保留本地已更新的部分
        return {
          ...propInitialData,
          cost_records: prev.cost_records || propInitialData.cost_records,
          profit_records: prev.profit_records || propInitialData.profit_records,
          progress_updates: prev.progress_updates || propInitialData.progress_updates
        };
      });
    }
  }, [propInitialData, isOpen]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const aiFileInputRef = useRef<HTMLInputElement>(null);
  const aiDropZoneRef = useRef<HTMLDivElement>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [isAiFilled, setIsAiFilled] = useState(false);
  const [isAiDragging, setIsAiDragging] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [urlLoading, setUrlLoading] = useState(false);
  const [progressContent, setProgressContent] = useState('');
  const [isAddingProgress, setIsAddingProgress] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [progressAttachments, setProgressAttachments] = useState<string[]>([]); // 進度更新的附件
  const [progressUrlInput, setProgressUrlInput] = useState(''); // 進度更新的網址輸入
  const progressFileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<Partial<Lead>>({
    platform: Platform.FB,
    contact_status: ContactStatus.UNRESPONDED,
    status: LeadStatus.TO_FILTER,
    priority: 3,
    need: '',
    budget_text: '',
    platform_id: '',
    phone: '',
    email: '',
    location: '',
    estimated_duration: '', // 預計製作週期
    contact_method: '', // 客戶聯繫方式
    note: '',
    internal_remarks: '',
    posted_at: new Date().toISOString().split('T')[0],
    links: []
  });

  // 使用 ref 來追蹤 Modal 是否剛打開
  const prevIsOpenRef = useRef(false);
  const prevInitialDataIdRef = useRef<string | null>(null);

  useEffect(() => {
    // 只在 Modal 剛打開時（從關閉變為打開）重置進度相關狀態
    const isModalJustOpened = !prevIsOpenRef.current && isOpen;
    const isDifferentLead = prevInitialDataIdRef.current !== (propInitialData?.id || null);
    
    // 只在 Modal 剛打開或切換到不同案件時才重置表單數據
    // 這樣可以避免在用戶輸入過程中覆蓋輸入內容
    if (isModalJustOpened || isDifferentLead) {
      // 過濾掉「未提供」字符串，將其轉換為空字符串
      const cleanValue = (value: string | null | undefined): string => {
        if (!value || value === '未提供' || value.trim() === '') return '';
        return value;
      };
      
      if (propInitialData) {
        // 更新內部狀態
        setInitialData(propInitialData);
        
        setFormData({
          ...propInitialData,
          // 確保所有可能為 null 的欄位都轉換為空字符串，並過濾「未提供」
          need: cleanValue(propInitialData.need),
          budget_text: cleanValue(propInitialData.budget_text),
          platform_id: cleanValue(propInitialData.platform_id),
          phone: cleanValue(propInitialData.phone),
          email: cleanValue(propInitialData.email),
          location: cleanValue(propInitialData.location),
          estimated_duration: cleanValue(propInitialData.estimated_duration),
          contact_method: cleanValue(propInitialData.contact_method),
          note: cleanValue(propInitialData.note),
          internal_remarks: cleanValue(propInitialData.internal_remarks),
          posted_at: propInitialData.posted_at ? propInitialData.posted_at.split('T')[0] : new Date().toISOString().split('T')[0]
        });
        setIsAiFilled(false);
      } else {
        setInitialData(null);
        setFormData({
          platform: Platform.FB,
          contact_status: ContactStatus.UNRESPONDED,
          status: LeadStatus.TO_FILTER,
          priority: 3,
          need: '',
          budget_text: '',
          platform_id: '',
          phone: '',
          email: '',
          location: '',
          estimated_duration: '',
          contact_method: '',
          note: '',
          internal_remarks: '',
          posted_at: new Date().toISOString().split('T')[0],
          links: []
        });
        setIsAiFilled(false);
      }
      
      // 重置進度相關狀態
      setProgressContent('');
      setProgressAttachments([]);
      setProgressUrlInput('');
      setShowHistory(false);
    } else if (propInitialData && propInitialData.id === prevInitialDataIdRef.current) {
      // 如果是同一個案件，合併更新 initialData 但不重置 formData
      // 這樣可以保持用戶正在輸入的內容，同時保留本地已更新的部分（如成本記錄、利潤記錄、進度更新）
      setInitialData(prev => {
        if (!prev) return propInitialData;
        // 合併更新，但優先保留本地已更新的部分
        return {
          ...propInitialData,
          cost_records: prev.cost_records || propInitialData.cost_records,
          profit_records: prev.profit_records || propInitialData.profit_records,
          progress_updates: prev.progress_updates || propInitialData.progress_updates
        };
      });
    }
    
    // 更新 ref 值
    prevIsOpenRef.current = isOpen;
    prevInitialDataIdRef.current = propInitialData?.id || null;
  }, [propInitialData, isOpen]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setFormData(prev => ({
          ...prev,
          links: [...(prev.links || []), base64String]
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  // 處理圖片文件的通用函數
  const processAiImageFile = async (file: File) => {
    // 檢查檔案類型
    if (!file.type.startsWith('image/')) {
      alert('請選擇圖片檔案');
      return;
    }

    // 檢查檔案大小（限制 10MB）
    if (file.size > 10 * 1024 * 1024) {
      alert('圖片大小不能超過 10MB');
      return;
    }

    setAiLoading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      try {
        const extracted = await extractLeadFromImage(base64String);
        setFormData(prev => ({
          ...prev,
          ...extracted,
          links: [...(prev.links || []), base64String]
        }));
        setIsAiFilled(true);
      } catch (err: any) {
        console.error('OCR 解析錯誤:', err);
        // 顯示更具體的錯誤訊息
        const errorMessage = err?.message || '未知錯誤';
        if (errorMessage.includes('無法識別') || errorMessage.includes('文字')) {
          alert(`❌ ${errorMessage}\n\n請確認圖片清晰可讀`);
        } else if (errorMessage.includes('worker') || errorMessage.includes('tesseract')) {
          alert(`❌ ${errorMessage}\n\n請重新整理頁面後再試`);
        } else {
          alert(`❌ OCR 解析失敗：${errorMessage}\n\n請確認圖片清晰可讀`);
        }
      } finally {
        setAiLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAiScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processAiImageFile(file);
  };

  // 拖放事件處理
  const handleAiDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsAiDragging(true);
  };

  const handleAiDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsAiDragging(false);
  };

  const handleAiDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsAiDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processAiImageFile(file);
    }
  };

  // 解析 Pro360 URL
  const parsePro360Url = (url: string) => {
    try {
      const urlObj = new URL(url);
      const params = new URLSearchParams(urlObj.search);
      
      const quoteBidId = params.get('quote_bid_id');
      const pk = params.get('pk');
      const from = params.get('from');
      
      let requestId = null;
      if (from) {
        const match = from.match(/\/requests\/(\d+)/);
        if (match) {
          requestId = match[1];
        }
      }
      
      return {
        platform: Platform.PRO360,
        platform_id: quoteBidId || requestId || pk || 'Unknown',
        quote_bid_id: quoteBidId,
        request_id: requestId,
        pk: pk,
        url: url
      };
    } catch (error) {
      console.error('URL 解析失敗:', error);
      return null;
    }
  };

  // 處理 URL 匯入
  const handleUrlImport = async () => {
    if (!urlInput.trim()) {
      alert('請輸入 URL');
      return;
    }

    setUrlLoading(true);
    const url = urlInput.trim();

    try {
      if (url.includes('pro360.com.tw')) {
        const parsed = parsePro360Url(url);
        if (!parsed) {
          alert('URL 格式錯誤，無法解析！');
          setUrlLoading(false);
          return;
        }

        // 自動填入表單
        setFormData(prev => ({
          ...prev,
          platform: parsed.platform,
          platform_id: parsed.platform_id,
          need: prev.need || `Pro360 案件 - 報價單 ID: ${parsed.quote_bid_id || parsed.request_id || 'N/A'}`,
          budget_text: prev.budget_text || '待確認',
          note: prev.note || `來源: Pro360\n報價單 ID: ${parsed.quote_bid_id || 'N/A'}\n請求 ID: ${parsed.request_id || 'N/A'}\nPK: ${parsed.pk || 'N/A'}`,
          links: [...(prev.links || []), url]
        }));

        setIsAiFilled(true);
        setUrlInput('');
        alert('✅ URL 解析成功！已自動填入表單，請檢查後儲存。');
      } else {
        // 其他平台的 URL
        setFormData(prev => ({
          ...prev,
          platform: Platform.OTHER,
          platform_id: prev.platform_id || 'URL Import',
          need: prev.need || '從 URL 匯入的案件',
          budget_text: prev.budget_text || '待確認',
          note: prev.note || `來源 URL: ${url}`,
          links: [...(prev.links || []), url]
        }));

        setIsAiFilled(true);
        setUrlInput('');
        alert('✅ URL 已添加！已自動填入表單，請檢查後儲存。');
      }
    } catch (error) {
      console.error('URL 匯入失敗:', error);
      alert('❌ URL 處理失敗，請檢查 URL 格式！');
    } finally {
      setUrlLoading(false);
    }
  };

  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      links: (prev.links || []).filter((_, i) => i !== index)
    }));
  };

  const handleAddProgress = async () => {
    // 必須有內容或附件才能提交
    if ((!progressContent.trim() && progressAttachments.length === 0) || !initialData?.id) {
      if (progressAttachments.length > 0 && !progressContent.trim()) {
        alert('請輸入進度內容或移除附件');
      }
      return;
    }
    
    setIsAddingProgress(true);
    try {
      console.log('📤 添加進度更新:', { 
        content: progressContent, 
        attachmentsCount: progressAttachments.length,
        leadId: initialData.id
      });
      
      const progressUpdate = await addProgressUpdate(
        initialData.id, 
        progressContent.trim() || '', // 確保內容不為空（即使只有附件也要有內容）
        progressAttachments.length > 0 ? progressAttachments : undefined
      );
      
      console.log('✅ 進度更新已創建:', progressUpdate);
      
      // 更新本地狀態，立即顯示新的進度更新
      if (progressUpdate && initialData) {
        const updatedProgressUpdates = [
          progressUpdate,
          ...(initialData.progress_updates || [])
        ];
        
        console.log('🔄 更新進度列表，總共:', updatedProgressUpdates.length, '筆');
        
        // 更新內部 initialData 狀態，立即顯示新的進度更新
        const updatedLead = {
          ...initialData,
          progress_updates: updatedProgressUpdates
        };
        setInitialData(updatedLead);
        
        console.log('📋 更新後的 initialData:', {
          id: updatedLead.id,
          progressUpdatesCount: updatedLead.progress_updates?.length || 0
        });
        
        // 清空輸入框
        setProgressContent('');
        setProgressAttachments([]);
        setProgressUrlInput('');
        
        // 觸發父組件更新，讓它知道數據已改變（但不關閉 Modal）
        // 只更新 progress_updates，不觸發完整的表單提交
        onSubmit({ progress_updates: updatedProgressUpdates });
      } else {
        console.warn('⚠️ 進度更新創建失敗或沒有 initialData');
      }
    } catch (err) {
      console.error('❌ 添加進度更新失敗:', err);
      alert('添加進度更新失敗: ' + (err instanceof Error ? err.message : '未知錯誤'));
    } finally {
      setIsAddingProgress(false);
    }
  };

  // 處理進度更新的圖片上傳
  const handleProgressFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file: File) => {
      // 檢查檔案類型
      if (!file.type.startsWith('image/')) {
        alert('請選擇圖片檔案');
        return;
      }
      // 檢查檔案大小（限制 5MB）
      if (file.size > 5 * 1024 * 1024) {
        alert('圖片大小不能超過 5MB');
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setProgressAttachments(prev => [...prev, base64String]);
      };
      reader.readAsDataURL(file);
    });
    
    // 清空 input 值，允許重複選擇同一檔案
    if (progressFileInputRef.current) {
      progressFileInputRef.current.value = '';
    }
  };

  // 處理進度更新的網址添加
  const handleAddProgressUrl = () => {
    if (!progressUrlInput.trim()) return;
    setProgressAttachments(prev => [...prev, progressUrlInput.trim()]);
    setProgressUrlInput('');
  };

  // 移除進度更新的附件
  const removeProgressAttachment = (index: number) => {
    setProgressAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // 成本和利潤記錄狀態
  const [costItemName, setCostItemName] = useState('');
  const [costAmount, setCostAmount] = useState('');
  const [costNote, setCostNote] = useState('');
  const [profitItemName, setProfitItemName] = useState('');
  const [profitAmount, setProfitAmount] = useState('');
  const [profitNote, setProfitNote] = useState('');
  const contractFileInputRef = useRef<HTMLInputElement>(null);

  // 添加成本記錄
  const handleAddCost = async () => {
    if (!costItemName.trim() || !costAmount) return;
    const amount = parseFloat(costAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('請輸入有效的金額');
      return;
    }

    const newCost: CostRecord = {
      id: 'cost_' + Math.random().toString(36).substr(2, 9),
      lead_id: initialData?.id || 'temp',
      item_name: costItemName.trim(),
      amount: amount,
      author_uid: userRole === Role.ADMIN ? 'admin' : 'user',
      author_name: userName,
      created_at: new Date().toISOString(),
      note: costNote.trim() || undefined
    };

    // 如果是編輯模式，調用 API
    if (initialData?.id) {
      try {
        const addedCost = await addCostRecord(initialData.id, {
          item_name: newCost.item_name,
          amount: newCost.amount,
          author_uid: newCost.author_uid,
          author_name: newCost.author_name,
          note: newCost.note
        });

        if (addedCost) {
          const updatedCosts = [...(initialData.cost_records || []), addedCost];
          const updatedLead = { ...initialData, cost_records: updatedCosts };
          setInitialData(updatedLead);
          onSubmit({ cost_records: updatedCosts });
        }
      } catch (error: any) {
        console.error('添加成本記錄失敗:', error);
        const errorMessage = error?.message || '未知錯誤';
        alert(`添加成本記錄失敗：${errorMessage}`);
        return;
      }
    } else {
      // 新增模式：直接添加到 formData
      const updatedCosts = [...(formData.cost_records || []), newCost];
      setFormData({ ...formData, cost_records: updatedCosts });
    }

    setCostItemName('');
    setCostAmount('');
    setCostNote('');
  };

  // 添加利潤記錄
  const handleAddProfit = async () => {
    if (!profitItemName.trim() || !profitAmount) return;
    const amount = parseFloat(profitAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('請輸入有效的金額');
      return;
    }

    const newProfit: ProfitRecord = {
      id: 'profit_' + Math.random().toString(36).substr(2, 9),
      lead_id: initialData?.id || 'temp',
      item_name: profitItemName.trim(),
      amount: amount,
      author_uid: userRole === Role.ADMIN ? 'admin' : 'user',
      author_name: userName,
      created_at: new Date().toISOString(),
      note: profitNote.trim() || undefined
    };

    // 如果是編輯模式，調用 API
    if (initialData?.id) {
      try {
        const addedProfit = await addProfitRecord(initialData.id, {
          item_name: newProfit.item_name,
          amount: newProfit.amount,
          author_uid: newProfit.author_uid,
          author_name: newProfit.author_name,
          note: newProfit.note
        });

        if (addedProfit) {
          const updatedProfits = [...(initialData.profit_records || []), addedProfit];
          const updatedLead = { ...initialData, profit_records: updatedProfits };
          setInitialData(updatedLead);
          onSubmit({ profit_records: updatedProfits });
        }
      } catch (error) {
        console.error('添加利潤記錄失敗:', error);
        alert('添加利潤記錄失敗');
        return;
      }
    } else {
      // 新增模式：直接添加到 formData
      const updatedProfits = [...(formData.profit_records || []), newProfit];
      setFormData({ ...formData, profit_records: updatedProfits });
    }

    setProfitItemName('');
    setProfitAmount('');
    setProfitNote('');
  };

  // 處理合約文件上傳
  const handleContractUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const updatedContracts = [...(formData.contracts || []), base64String];
        setFormData(prev => ({ ...prev, contracts: updatedContracts }));
      };
      reader.readAsDataURL(file);
    });

    if (contractFileInputRef.current) {
      contractFileInputRef.current.value = '';
    }
  };

  const removeContract = (index: number) => {
    setFormData(prev => ({
      ...prev,
      contracts: (prev.contracts || []).filter((_, i) => i !== index)
    }));
  };

  // 刪除進度更新（僅 Admin）
  const handleDeleteProgress = (progressId: string) => {
    if (userRole !== Role.ADMIN) return;
    if (!window.confirm('確定要刪除此進度更新嗎？')) return;
    
    if (!initialData?.id) return;
    const updatedProgress = (initialData.progress_updates || []).filter(p => p.id !== progressId);
    const updatedLead = { ...initialData, progress_updates: updatedProgress };
    setInitialData(updatedLead);
    onSubmit({ progress_updates: updatedProgress });
  };

  // 刪除成本記錄（僅 Admin）
  const handleDeleteCost = async (costId: string) => {
    if (userRole !== Role.ADMIN) return;
    if (!window.confirm('確定要刪除此成本記錄嗎？')) return;
    
    // 如果是編輯模式，調用 API
    if (initialData?.id) {
      try {
        await deleteCostRecord(initialData.id, costId);
        const updatedCosts = (initialData.cost_records || []).filter(c => c.id !== costId);
        const updatedLead = { ...initialData, cost_records: updatedCosts };
        setInitialData(updatedLead);
        onSubmit({ cost_records: updatedCosts });
      } catch (error) {
        console.error('刪除成本記錄失敗:', error);
        alert('刪除成本記錄失敗');
      }
    } else {
      // 新增模式：直接從 formData 中移除
      const updatedCosts = (formData.cost_records || []).filter(c => c.id !== costId);
      setFormData({ ...formData, cost_records: updatedCosts });
    }
  };

  // 刪除利潤記錄（僅 Admin）
  const handleDeleteProfit = async (profitId: string) => {
    if (userRole !== Role.ADMIN) return;
    if (!window.confirm('確定要刪除此利潤記錄嗎？')) return;
    
    // 如果是編輯模式，調用 API
    if (initialData?.id) {
      try {
        await deleteProfitRecord(initialData.id, profitId);
        const updatedProfits = (initialData.profit_records || []).filter(p => p.id !== profitId);
        const updatedLead = { ...initialData, profit_records: updatedProfits };
        setInitialData(updatedLead);
        onSubmit({ profit_records: updatedProfits });
      } catch (error) {
        console.error('刪除利潤記錄失敗:', error);
        alert('刪除利潤記錄失敗');
      }
    } else {
      // 新增模式：直接從 formData 中移除
      const updatedProfits = (formData.profit_records || []).filter(p => p.id !== profitId);
      setFormData({ ...formData, profit_records: updatedProfits });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-TW', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFieldLabel = (field: string): string => {
    const labels: Record<string, string> = {
      platform: '來源平台',
      platform_id: '對方 ID / 名稱',
      need: '客戶原始需求',
      budget_text: '預算狀況',
      phone: '電話',
      email: '電子郵件',
      location: '地點',
      status: '案件狀態',
      contact_status: '聯絡狀態',
      internal_remarks: '內部備註',
      note: '備註'
    };
    return labels[field] || field;
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedData = { ...formData };
    if (formData.internal_remarks !== initialData?.internal_remarks) {
      updatedData.remarks_author = userName;
    }
    // Ensure posted_at is valid ISO
    if (formData.posted_at) {
      updatedData.posted_at = new Date(formData.posted_at).toISOString();
    }
    // 確保可選欄位（電話、email、地點、預計製作週期、客戶聯繫方式）如果為空字符串則設為 null
    // 這樣後端可以正確處理，避免保存空字符串
    const optionalFields = ['phone', 'email', 'location', 'estimated_duration', 'contact_method'];
    optionalFields.forEach(field => {
      if (updatedData[field as keyof typeof updatedData] === '') {
        (updatedData as any)[field] = null;
      }
    });
    onSubmit(updatedData);
  };

  if (!isOpen) return null;

  const isAdmin = userRole === Role.ADMIN;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md transition-all">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden border border-white/20 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-8 border-b bg-white/50 backdrop-blur-xl z-10">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl ${initialData ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
              <Plus size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 leading-tight">
                {initialData?.id ? '修改案件資訊' : (isAiFilled ? '確認 AI 擷取結果' : '新增客戶案件')}
              </h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1 flex items-center gap-1">
                {isAiFilled ? <><Sparkles size={12} className="text-indigo-500" /> AI 已自動填入下方資訊</> : '請填寫客戶的原始需求資訊'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-slate-900 transition-colors p-2 hover:bg-slate-50 rounded-2xl">
            <X size={32} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-8 scrollbar-hide">
          <form id="lead-form" className="space-y-10" onSubmit={handleFormSubmit}>
            {/* AI 截圖匯入和 URL 匯入 */}
            {!initialData && (
              <div className="space-y-4">
                {/* AI 截圖匯入 */}
                <div
                  ref={aiDropZoneRef}
                  onDragOver={handleAiDragOver}
                  onDragLeave={handleAiDragLeave}
                  onDrop={handleAiDrop}
                  onClick={() => !aiLoading && aiFileInputRef.current?.click()}
                  className={`bg-gradient-to-r from-indigo-50 to-violet-50 p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                    isAiDragging
                      ? 'border-indigo-500 bg-indigo-100 scale-[1.02] shadow-lg'
                      : 'border-indigo-200 hover:border-indigo-300 hover:shadow-md'
                  } ${aiLoading ? 'opacity-75 cursor-wait' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-indigo-600 text-white p-3 rounded-xl">
                        <Camera size={20} />
                      </div>
                      <div>
                        <p className="font-black text-indigo-900 text-sm">OCR 截圖匯入</p>
                        <p className="text-indigo-600/70 font-bold text-xs">
                          {isAiDragging ? '放開以上傳' : aiLoading ? '正在識別文字...' : '拖放截圖至此或點擊上傳'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {aiLoading ? (
                        <div className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-black text-sm flex items-center gap-2">
                          <Loader2 className="animate-spin" size={16} />
                          OCR 識別中...
                        </div>
                      ) : (
                        <div className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-black text-sm flex items-center gap-2 hover:bg-indigo-700 transition-all">
                          <Sparkles size={16} />
                          選擇截圖
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* URL 快速匯入 */}
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-2xl border-2 border-purple-200">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="bg-purple-600 text-white p-3 rounded-xl">
                        <LinkIcon size={20} />
                      </div>
                      <div>
                        <p className="font-black text-purple-900 text-sm">URL 快速匯入</p>
                        <p className="text-purple-600/70 font-bold text-xs">貼上 Pro360 等平台網址自動填入</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleUrlImport();
                          }
                        }}
                        placeholder="貼上 Pro360 URL，例如：https://www.pro360.com.tw/..."
                        className="flex-1 px-4 py-2.5 bg-white border-2 border-purple-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                      />
                      <button
                        type="button"
                        onClick={handleUrlImport}
                        disabled={urlLoading || !urlInput.trim()}
                        className="px-6 py-2.5 bg-purple-600 text-white rounded-xl font-black text-sm hover:bg-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {urlLoading ? (
                          <>
                            <Loader2 className="animate-spin" size={16} />
                            處理中...
                          </>
                        ) : (
                          <>
                            <LinkIcon size={16} />
                            匯入
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* AI Highlight Banner */}
            {isAiFilled && (
              <div className="bg-gradient-to-r from-indigo-50 to-violet-50 p-4 rounded-2xl border border-indigo-100 flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
                <div className="bg-indigo-600 text-white p-2 rounded-xl"><Sparkles size={16}/></div>
                <div className="text-sm">
                  <p className="font-black text-indigo-900">AI 智能掃描成功！</p>
                  <p className="text-indigo-600/70 font-bold text-xs uppercase tracking-tight">請檢查欄位內容是否正確後儲存</p>
                </div>
              </div>
            )}

            {/* 基本欄位 */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">來源平台</label>
                <select 
                      className={`w-full rounded-2xl border-2 p-4 font-black transition-all appearance-none ${isAiFilled ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-100 bg-slate-50 focus:bg-white focus:border-indigo-500'} text-slate-800`}
                  value={formData.platform}
                  onChange={(e) => setFormData({ ...formData, platform: e.target.value as Platform })}
                >
                  {PLATFORM_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                    <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">對方 ID / 名稱</label>
                      {initialData?.case_code && (
                        <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
                          {initialData.case_code}
                        </span>
                      )}
                    </div>
                <input 
                  type="text" 
                  placeholder="例如：王小明"
                      className={`w-full rounded-2xl border-2 p-4 font-bold transition-all ${isAiFilled ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-100 bg-slate-50 focus:bg-white focus:border-indigo-500'} text-slate-800`}
                      value={formData.platform_id || ''}
                  onChange={(e) => setFormData({ ...formData, platform_id: e.target.value })}
                />
              </div>
            </section>

            {/* 時間與預算 */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <Calendar size={12}/> 案件發布時間
                </label>
                <input 
                  disabled={!isAdmin}
                  type="date"
                  className={`w-full rounded-2xl border-2 p-4 font-black transition-all ${isAiFilled ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-100 bg-slate-50 focus:bg-white focus:border-indigo-500'} text-slate-800`}
                  value={formData.posted_at}
                  onChange={(e) => setFormData({ ...formData, posted_at: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">預算狀況</label>
                <input type="text" placeholder="例如：1萬以下" className={`w-full rounded-2xl border-2 p-4 font-black transition-all ${isAiFilled ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-100 bg-slate-50 focus:bg-white focus:border-indigo-500'} text-slate-800`} value={formData.budget_text || ''} onChange={(e) => setFormData({ ...formData, budget_text: e.target.value })} />
              </div>
            </section>

            {/* 預計製作週期與客戶聯繫方式 */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">預計製作週期</label>
                <input 
                  type="text" 
                  placeholder="例如：2週、1個月、3個月"
                  className={`w-full rounded-2xl border-2 p-4 font-black transition-all ${isAiFilled ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-100 bg-slate-50 focus:bg-white focus:border-indigo-500'} text-slate-800`}
                  value={formData.estimated_duration || ''}
                  onChange={(e) => setFormData({ ...formData, estimated_duration: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">客戶聯繫方式</label>
                <input 
                  type="text" 
                  placeholder="例如：電話、Email、Line、Facebook"
                  className={`w-full rounded-2xl border-2 p-4 font-black transition-all ${isAiFilled ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-100 bg-slate-50 focus:bg-white focus:border-indigo-500'} text-slate-800`}
                  value={formData.contact_method || ''}
                  onChange={(e) => setFormData({ ...formData, contact_method: e.target.value })}
                />
              </div>
            </section>

            {/* 聯絡資訊（電話、Email、地點） */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">電話</label>
                <input 
                  type="text" 
                  placeholder="例如：0912-345-678"
                  className={`w-full rounded-2xl border-2 p-4 font-black transition-all ${isAiFilled ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-100 bg-slate-50 focus:bg-white focus:border-indigo-500'} text-slate-800`}
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>
                <input 
                  type="text" 
                  placeholder="例如：example@email.com"
                  className={`w-full rounded-2xl border-2 p-4 font-black transition-all ${isAiFilled ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-100 bg-slate-50 focus:bg-white focus:border-indigo-500'} text-slate-800`}
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">地點</label>
                <input 
                  type="text" 
                  placeholder="例如：台北市"
                  className={`w-full rounded-2xl border-2 p-4 font-black transition-all ${isAiFilled ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-100 bg-slate-50 focus:bg-white focus:border-indigo-500'} text-slate-800`}
                  value={formData.location || ''}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
              </div>
            </section>

            {/* 需求說明 */}
            <section className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">客戶原始需求</label>
              <textarea 
                rows={4}
                placeholder="在此填寫內容..."
                className={`w-full rounded-2xl border-2 p-5 font-medium leading-relaxed transition-all ${isAiFilled ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-100 bg-slate-50 focus:bg-white focus:border-indigo-500'} text-slate-800`}
                value={formData.need || ''}
                onChange={(e) => setFormData({ ...formData, need: e.target.value })}
              />
            </section>

            {/* 內部備註 */}
            <section className="p-6 bg-slate-900 rounded-[2rem] text-white space-y-4 shadow-xl shadow-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-indigo-500 rounded-xl flex items-center justify-center"><MessageSquare size={16}/></div>
                  <h3 className="text-sm font-black uppercase tracking-widest">內部備註 (實名紀錄)</h3>
                </div>
                {formData.remarks_author && (
                  <div className="px-3 py-1 bg-white/10 rounded-full flex items-center gap-2 border border-white/10">
                    <User size={10} className="text-indigo-400" />
                    <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">填寫者：{formData.remarks_author}</span>
                  </div>
                )}
              </div>
              <textarea 
                rows={2}
                placeholder="筆記或判斷理由..."
                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition-all"
                value={formData.internal_remarks || ''}
                onChange={(e) => setFormData({ ...formData, internal_remarks: e.target.value })}
              />
            </section>

            {/* 圖片管理 */}
            <section className="space-y-4">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">附件截圖</label>
              <div className="grid grid-cols-4 md:grid-cols-6 gap-4">
                {(formData.links || []).map((link, index) => (
                  <div key={index} className="relative group aspect-square rounded-2xl overflow-hidden border-2 border-slate-100 shadow-sm transition-all hover:shadow-lg">
                    <img src={link} alt="Attachment" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => removeImage(index)} className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-xl opacity-0 group-hover:opacity-100 transition-all shadow-xl active:scale-90">
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center justify-center aspect-square rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 text-slate-400 hover:border-indigo-400 hover:bg-indigo-50 transition-all group">
                  <Upload size={24} className="group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] mt-2 font-black uppercase tracking-widest">加圖片</span>
                </button>
              </div>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handleFileUpload} />
            </section>

            {/* 近期進度更新 - 僅在編輯模式下顯示 */}
            {initialData?.id && (
              <section className="space-y-4 p-6 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border-2 border-emerald-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-emerald-600 rounded-xl flex items-center justify-center">
                      <TrendingUp size={16} className="text-white" />
                    </div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-emerald-900">近期進度更新</h3>
                  </div>
                </div>
                
                {/* 添加進度更新 */}
                <div className="space-y-3">
                  <textarea
                    rows={3}
                    placeholder="記錄案件進度..."
                    className="w-full rounded-xl border-2 border-emerald-200 bg-white p-3 text-sm font-medium focus:ring-2 focus:ring-emerald-500 transition-all resize-none"
                    value={progressContent}
                    onChange={(e) => setProgressContent(e.target.value)}
                    onKeyDown={(e) => {
                      // 阻止 Enter 鍵觸發表單提交（Shift+Enter 可以換行）
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        e.stopPropagation();
                      }
                    }}
                  />
                  
                  {/* 附件上傳區域 */}
                  <div className="space-y-2">
                    {/* 網址輸入 */}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={progressUrlInput}
                        onChange={(e) => setProgressUrlInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddProgressUrl(); } }}
                        placeholder="貼上網址..."
                        className="flex-1 rounded-xl border-2 border-emerald-200 bg-white p-2 text-sm font-medium focus:ring-2 focus:ring-emerald-500 transition-all"
                      />
                      <button
                        type="button"
                        onClick={handleAddProgressUrl}
                        disabled={!progressUrlInput.trim()}
                        className="px-3 py-2 bg-emerald-600 text-white rounded-xl font-black text-xs hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                      >
                        <LinkIcon size={14} />
                        添加網址
                      </button>
                    </div>
                    
                    {/* 圖片上傳按鈕 */}
                    <button
                      type="button"
                      onClick={() => progressFileInputRef.current?.click()}
                      className="w-full px-4 py-2 bg-emerald-50 border-2 border-emerald-200 text-emerald-700 rounded-xl font-black text-sm hover:bg-emerald-100 transition-all flex items-center justify-center gap-2"
                    >
                      <ImageIcon size={16} />
                      上傳圖片
                    </button>
                    <input
                      type="file"
                      ref={progressFileInputRef}
                      className="hidden"
                      accept="image/*"
                      multiple
                      onChange={handleProgressFileUpload}
                    />
                    
                    {/* 顯示已添加的附件 */}
                    {progressAttachments.length > 0 && (
                      <div className="grid grid-cols-4 gap-2">
                        {progressAttachments.map((attachment, index) => (
                          <div key={index} className="relative group aspect-square rounded-xl overflow-hidden border-2 border-emerald-200">
                            {attachment.startsWith('data:image') || attachment.startsWith('http') ? (
                              <img
                                src={attachment}
                                alt={`附件 ${index + 1}`}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  // 如果不是圖片，顯示為連結圖標
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-full h-full bg-emerald-50 flex items-center justify-center">
                                <LinkIcon size={20} className="text-emerald-600" />
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => removeProgressAttachment(index)}
                              className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <button
                    type="button"
                    onClick={handleAddProgress}
                    disabled={(!progressContent.trim() && progressAttachments.length === 0) || isAddingProgress}
                    className="w-full px-4 py-2 bg-emerald-600 text-white rounded-xl font-black text-sm hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isAddingProgress ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        添加中...
                      </>
                    ) : (
                      <>
                        <Plus size={16} />
                        添加進度
                      </>
                    )}
                  </button>
                </div>

                {/* 顯示進度更新列表 */}
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {(initialData.progress_updates || []).map((update: ProgressUpdate) => (
                    <div key={update.id} className="bg-white/80 rounded-xl p-3 border border-emerald-100 relative group">
                      {userRole === Role.ADMIN && (
                        <button
                          type="button"
                          onClick={() => handleDeleteProgress(update.id)}
                          className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all shadow-lg hover:bg-red-600"
                          title="刪除此進度更新"
                        >
                          <X size={14} />
                        </button>
                      )}
                      {update.content && (
                        <div className="mb-2">
                          <p className="text-sm font-medium text-slate-800 whitespace-pre-wrap">{update.content}</p>
                        </div>
                      )}
                      
                      {/* 顯示附件 */}
                      {update.attachments && update.attachments.length > 0 && (
                        <div className="grid grid-cols-4 gap-2 mt-2">
                          {update.attachments.map((attachment, index) => (
                            <div key={index} className="relative aspect-square rounded-lg overflow-hidden border border-emerald-200">
                              {attachment.startsWith('data:image') || attachment.startsWith('http') ? (
                                <a
                                  href={attachment}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block w-full h-full"
                                >
                                  <img
                                    src={attachment}
                                    alt={`附件 ${index + 1}`}
                                    className="w-full h-full object-cover hover:opacity-80 transition-opacity"
                                    onError={(e) => {
                                      // 如果不是圖片，顯示為連結
                                      e.currentTarget.style.display = 'none';
                                    }}
                                  />
                                </a>
                              ) : (
                                <a
                                  href={attachment}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-full h-full bg-emerald-50 flex items-center justify-center hover:bg-emerald-100 transition-colors"
                                >
                                  <LinkIcon size={16} className="text-emerald-600" />
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2 mt-2 text-xs text-emerald-600">
                        <User size={12} />
                        <span className="font-bold">{update.author_name}</span>
                        <span className="text-emerald-400">•</span>
                        <span>{formatDate(update.created_at)}</span>
                      </div>
                    </div>
                  ))}
                  {(!initialData.progress_updates || initialData.progress_updates.length === 0) && (
                    <p className="text-sm text-emerald-600/70 text-center py-4">尚無進度更新記錄</p>
                  )}
                </div>
              </section>
            )}

            {/* 成本和利潤記錄 - 新增和編輯模式都顯示 */}
            <section className="space-y-6">
                {/* 成本記錄 */}
                <div className="p-6 bg-gradient-to-br from-red-50 to-orange-50 rounded-2xl border-2 border-red-200">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 bg-red-600 rounded-xl flex items-center justify-center">
                      <TrendingDown size={16} className="text-white" />
                    </div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-red-900">成本記錄</h3>
                  </div>
                  
                  {/* 快速添加預設成本名目 */}
                  <div className="mb-4">
                    <p className="text-xs font-black text-red-700 uppercase tracking-widest mb-2">快速添加</p>
                    <div className="flex flex-wrap gap-2">
                      {DEFAULT_COST_ITEMS.map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setCostItemName(item)}
                          className="px-3 py-1.5 bg-white border-2 border-red-200 text-red-700 rounded-lg text-xs font-bold hover:bg-red-50 hover:border-red-300 transition-all"
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3 mb-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <input
                        type="text"
                        placeholder="成本名目（例如：材料費）"
                        className="rounded-xl border-2 border-red-200 bg-white p-3 text-sm font-medium focus:ring-2 focus:ring-red-500"
                        value={costItemName}
                        onChange={(e) => setCostItemName(e.target.value)}
                        list="cost-items"
                      />
                      <datalist id="cost-items">
                        {DEFAULT_COST_ITEMS.map((item) => (
                          <option key={item} value={item} />
                        ))}
                      </datalist>
                      <input
                        type="number"
                        placeholder="金額"
                        className="rounded-xl border-2 border-red-200 bg-white p-3 text-sm font-medium focus:ring-2 focus:ring-red-500"
                        value={costAmount}
                        onChange={(e) => setCostAmount(e.target.value)}
                        min="0"
                        step="0.01"
                      />
                      <button
                        type="button"
                        onClick={handleAddCost}
                        disabled={!costItemName.trim() || !costAmount}
                        className="px-4 py-3 bg-red-600 text-white rounded-xl font-black text-sm hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Plus size={16} className="inline mr-2" />
                        添加成本
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="備註（選填）"
                      className="w-full rounded-xl border-2 border-red-200 bg-white p-3 text-sm font-medium focus:ring-2 focus:ring-red-500"
                      value={costNote}
                      onChange={(e) => setCostNote(e.target.value)}
                    />
                  </div>

                  {/* 成本記錄列表 */}
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {((initialData?.cost_records || formData.cost_records) || []).map((cost: CostRecord) => (
                      <div key={cost.id} className="bg-white/80 rounded-xl p-3 border border-red-100 relative group">
                        {userRole === Role.ADMIN && (
                          <button
                            type="button"
                            onClick={() => handleDeleteCost(cost.id)}
                            className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all shadow-lg hover:bg-red-600"
                            title="刪除此成本記錄"
                          >
                            <X size={14} />
                          </button>
                        )}
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-bold text-slate-800">{cost.item_name}</p>
                            {cost.note && <p className="text-xs text-slate-500 mt-1">{cost.note}</p>}
                            <p className="text-xs text-slate-400 mt-1">{cost.author_name} • {formatDate(cost.created_at)}</p>
                          </div>
                          <p className="text-lg font-black text-red-600">${cost.amount.toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                    {((initialData?.cost_records || formData.cost_records) || []).length === 0 && (
                      <p className="text-sm text-red-600/70 text-center py-4">尚無成本記錄</p>
                    )}
                  </div>
                </div>

                {/* 利潤記錄 */}
                <div className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl border-2 border-green-200">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 bg-green-600 rounded-xl flex items-center justify-center">
                      <TrendingUp size={16} className="text-white" />
                    </div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-green-900">利潤記錄</h3>
                  </div>
                  
                  <div className="space-y-3 mb-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <input
                        type="text"
                        placeholder="利潤名目（例如：專案收入）"
                        className="rounded-xl border-2 border-green-200 bg-white p-3 text-sm font-medium focus:ring-2 focus:ring-green-500"
                        value={profitItemName}
                        onChange={(e) => setProfitItemName(e.target.value)}
                      />
                      <input
                        type="number"
                        placeholder="金額"
                        className="rounded-xl border-2 border-green-200 bg-white p-3 text-sm font-medium focus:ring-2 focus:ring-green-500"
                        value={profitAmount}
                        onChange={(e) => setProfitAmount(e.target.value)}
                        min="0"
                        step="0.01"
                      />
                      <button
                        type="button"
                        onClick={handleAddProfit}
                        disabled={!profitItemName.trim() || !profitAmount}
                        className="px-4 py-3 bg-green-600 text-white rounded-xl font-black text-sm hover:bg-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Plus size={16} className="inline mr-2" />
                        添加利潤
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="備註（選填）"
                      className="w-full rounded-xl border-2 border-green-200 bg-white p-3 text-sm font-medium focus:ring-2 focus:ring-green-500"
                      value={profitNote}
                      onChange={(e) => setProfitNote(e.target.value)}
                    />
                  </div>

                  {/* 利潤記錄列表 */}
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {((initialData?.profit_records || formData.profit_records) || []).map((profit: ProfitRecord) => (
                      <div key={profit.id} className="bg-white/80 rounded-xl p-3 border border-green-100 relative group">
                        {userRole === Role.ADMIN && (
                          <button
                            type="button"
                            onClick={() => handleDeleteProfit(profit.id)}
                            className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all shadow-lg hover:bg-red-600"
                            title="刪除此利潤記錄"
                          >
                            <X size={14} />
                          </button>
                        )}
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-bold text-slate-800">{profit.item_name}</p>
                            {profit.note && <p className="text-xs text-slate-500 mt-1">{profit.note}</p>}
                            <p className="text-xs text-slate-400 mt-1">{profit.author_name} • {formatDate(profit.created_at)}</p>
                          </div>
                          <p className="text-lg font-black text-green-600">${profit.amount.toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                    {((initialData?.profit_records || formData.profit_records) || []).length === 0 && (
                      <p className="text-sm text-green-600/70 text-center py-4">尚無利潤記錄</p>
                    )}
                  </div>
                </div>
            </section>

            {/* 合約文件 - 僅在編輯模式下顯示 */}
            {initialData?.id && (
              <section className="space-y-4">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <FileText size={14} />
                  合約文件
                </label>
                <div className="grid grid-cols-4 md:grid-cols-6 gap-4">
                  {(formData.contracts || []).map((contract, index) => (
                    <div key={index} className="relative group aspect-square rounded-2xl overflow-hidden border-2 border-indigo-200 shadow-sm transition-all hover:shadow-lg">
                      {contract.startsWith('data:image') ? (
                        <img src={contract} alt="Contract" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-indigo-50 flex items-center justify-center">
                          <FileText size={32} className="text-indigo-400" />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeContract(index)}
                        className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-xl opacity-0 group-hover:opacity-100 transition-all shadow-xl active:scale-90"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => contractFileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center aspect-square rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50 text-indigo-400 hover:border-indigo-400 hover:bg-indigo-100 transition-all group"
                  >
                    <FileText size={24} className="group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] mt-2 font-black uppercase tracking-widest">加合約</span>
                  </button>
                </div>
                <input
                  type="file"
                  ref={contractFileInputRef}
                  className="hidden"
                  accept="image/*,.pdf,.doc,.docx"
                  multiple
                  onChange={handleContractUpload}
                />
              </section>
            )}

            {/* 修改歷史記錄 - 僅在編輯模式下顯示 */}
            {initialData?.id && (
              <section className="space-y-4">
                <button
                  type="button"
                  onClick={() => setShowHistory(!showHistory)}
                  className="w-full flex items-center justify-between p-4 bg-slate-100 rounded-2xl hover:bg-slate-200 transition-all"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-slate-600 rounded-xl flex items-center justify-center">
                      <History size={16} className="text-white" />
                    </div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">修改歷史記錄</h3>
                    {(initialData.change_history || []).length > 0 && (
                      <span className="px-2 py-1 bg-slate-600 text-white text-xs font-black rounded-full">
                        {(initialData.change_history || []).length}
                      </span>
                    )}
                  </div>
                  <span className="text-slate-400 text-xs font-bold">
                    {showHistory ? '收起' : '展開'}
                  </span>
                </button>

                {showHistory && (
                  <div className="space-y-2 max-h-64 overflow-y-auto bg-slate-50 rounded-xl p-4">
                    {(initialData.change_history || []).map((change: ChangeHistory) => (
                      <div key={change.id} className="bg-white rounded-xl p-3 border border-slate-200">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className="text-xs font-black text-slate-600 uppercase tracking-widest">
                            {getFieldLabel(change.field)}
                          </span>
                          <span className="text-xs text-slate-400">{formatDate(change.created_at)}</span>
                        </div>
                        <div className="space-y-1 text-sm">
                          {change.old_value !== undefined && change.old_value !== null && (
                            <div className="flex items-start gap-2">
                              <span className="text-red-600 font-bold">舊值：</span>
                              <span className="text-slate-600 line-through">{String(change.old_value)}</span>
                            </div>
                          )}
                          {change.new_value !== undefined && change.new_value !== null && (
                            <div className="flex items-start gap-2">
                              <span className="text-emerald-600 font-bold">新值：</span>
                              <span className="text-slate-800 font-medium">{String(change.new_value)}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                          <User size={12} />
                          <span className="font-bold">{change.author_name}</span>
                        </div>
                      </div>
                    ))}
                    {(!initialData.change_history || initialData.change_history.length === 0) && (
                      <p className="text-sm text-slate-400 text-center py-4">尚無修改記錄</p>
                    )}
                  </div>
                )}
              </section>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="p-8 border-t bg-slate-50/80 backdrop-blur-md flex justify-end gap-4">
          <button type="button" onClick={onClose} className="px-8 py-4 text-sm font-black text-slate-500 hover:text-slate-900 transition-all">取消</button>
          <button form="lead-form" type="submit" className="px-12 py-4 text-sm font-black text-white bg-slate-900 rounded-2xl hover:bg-black shadow-2xl shadow-slate-200 active:scale-95 transition-all">
            確認並儲存案件
          </button>
        </div>
      </div>

      <input type="file" ref={aiFileInputRef} className="hidden" accept="image/*" onChange={handleAiScan} />
    </div>
  );
};

export default LeadModal;
