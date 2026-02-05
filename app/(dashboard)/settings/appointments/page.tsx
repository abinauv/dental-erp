'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Calendar, Clock, Plus, Trash2, Save } from 'lucide-react';
import { format } from 'date-fns';

export default function AppointmentSettingsPage() {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [newHoliday, setNewHoliday] = useState({ name: '', date: '' });

  const [settings, setSettings] = useState({
    slotDuration: '30',
    bufferTime: '10',
    startTime: '09:00',
    endTime: '20:00',
    lunchBreakStart: '13:00',
    lunchBreakEnd: '14:00',
    maxAdvanceBookingDays: '30',
    reminderHoursBefore: '24',
  });

  useEffect(() => {
    fetchSettings();
    fetchHolidays();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings?category=appointments');
      const result = await response.json();

      if (result.success && result.data) {
        const settingsMap: any = {};
        result.data.forEach((s: any) => {
          const key = s.key.replace('appointments.', '');
          settingsMap[key] = s.value;
        });

        setSettings(prev => ({ ...prev, ...settingsMap }));
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    }
  };

  const fetchHolidays = async () => {
    try {
      const currentYear = new Date().getFullYear();
      const response = await fetch(`/api/settings/holidays?year=${currentYear}`);
      const result = await response.json();

      if (result.success) {
        setHolidays(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch holidays:', error);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const settingsArray = Object.entries(settings).map(([key, value]) => ({
        key: `appointments.${key}`,
        value: value.toString(),
        category: 'appointments',
      }));

      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: settingsArray }),
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Appointment settings saved successfully',
        });
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAddHoliday = async () => {
    if (!newHoliday.name || !newHoliday.date) {
      toast({
        title: 'Error',
        description: 'Please enter holiday name and date',
        variant: 'destructive',
      });
      return;
    }

    try {
      const response = await fetch('/api/settings/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newHoliday.name,
          date: new Date(newHoliday.date).toISOString(),
        }),
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Holiday added successfully',
        });
        setNewHoliday({ name: '', date: '' });
        fetchHolidays();
      } else {
        throw new Error('Failed to add holiday');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    try {
      const response = await fetch(`/api/settings/holidays?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Holiday deleted successfully',
        });
        fetchHolidays();
      } else {
        throw new Error('Failed to delete holiday');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Calendar className="w-8 h-8" />
          Appointment Settings
        </h1>
        <p className="text-gray-600">Configure appointment scheduling and timing</p>
      </div>

      <div className="space-y-6">
        {/* Slot Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Time Slot Configuration</CardTitle>
            <CardDescription>Set default appointment duration and buffer time</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="slotDuration">Default Slot Duration (minutes)</Label>
                <Input
                  id="slotDuration"
                  type="number"
                  value={settings.slotDuration}
                  onChange={(e) => setSettings({ ...settings, slotDuration: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="bufferTime">Buffer Time Between Appointments (minutes)</Label>
                <Input
                  id="bufferTime"
                  type="number"
                  value={settings.bufferTime}
                  onChange={(e) => setSettings({ ...settings, bufferTime: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Working Hours */}
        <Card>
          <CardHeader>
            <CardTitle>Working Hours</CardTitle>
            <CardDescription>Set clinic operating hours</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startTime">Clinic Start Time</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={settings.startTime}
                  onChange={(e) => setSettings({ ...settings, startTime: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="endTime">Clinic End Time</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={settings.endTime}
                  onChange={(e) => setSettings({ ...settings, endTime: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="lunchBreakStart">Lunch Break Start</Label>
                <Input
                  id="lunchBreakStart"
                  type="time"
                  value={settings.lunchBreakStart}
                  onChange={(e) => setSettings({ ...settings, lunchBreakStart: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="lunchBreakEnd">Lunch Break End</Label>
                <Input
                  id="lunchBreakEnd"
                  type="time"
                  value={settings.lunchBreakEnd}
                  onChange={(e) => setSettings({ ...settings, lunchBreakEnd: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Booking Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Booking Settings</CardTitle>
            <CardDescription>Configure booking restrictions and reminders</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="maxAdvanceBookingDays">Maximum Advance Booking (days)</Label>
                <Input
                  id="maxAdvanceBookingDays"
                  type="number"
                  value={settings.maxAdvanceBookingDays}
                  onChange={(e) => setSettings({ ...settings, maxAdvanceBookingDays: e.target.value })}
                />
                <p className="text-sm text-gray-500 mt-1">
                  How far in advance patients can book appointments
                </p>
              </div>

              <div>
                <Label htmlFor="reminderHoursBefore">Reminder Time (hours before)</Label>
                <Input
                  id="reminderHoursBefore"
                  type="number"
                  value={settings.reminderHoursBefore}
                  onChange={(e) => setSettings({ ...settings, reminderHoursBefore: e.target.value })}
                />
                <p className="text-sm text-gray-500 mt-1">
                  When to send appointment reminders
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Holidays */}
        <Card>
          <CardHeader>
            <CardTitle>Holiday Calendar</CardTitle>
            <CardDescription>Manage clinic holidays and closures</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Add Holiday Form */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <h4 className="font-semibold mb-3">Add New Holiday</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-1">
                  <Input
                    placeholder="Holiday name"
                    value={newHoliday.name}
                    onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                  />
                </div>
                <div>
                  <Input
                    type="date"
                    value={newHoliday.date}
                    onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                  />
                </div>
                <div>
                  <Button onClick={handleAddHoliday} className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Holiday
                  </Button>
                </div>
              </div>
            </div>

            {/* Holidays List */}
            <div className="space-y-2">
              <h4 className="font-semibold">Upcoming Holidays</h4>
              {holidays.length === 0 ? (
                <p className="text-sm text-gray-500">No holidays configured</p>
              ) : (
                <div className="space-y-2">
                  {holidays.map((holiday) => (
                    <div
                      key={holiday.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{holiday.name}</p>
                        <p className="text-sm text-gray-500">
                          {format(new Date(holiday.date), 'dd MMM yyyy')}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteHoliday(holiday.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSaveSettings} disabled={saving} size="lg">
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Appointment Settings'}
          </Button>
        </div>
      </div>
    </div>
  );
}
