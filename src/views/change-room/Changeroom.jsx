import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './Changeroom.css';
import Header from '../../components/common/Header';
import { FaSearch, FaCalendar, FaUser, FaRulerCombined, FaExclamationTriangle, FaArrowLeft, FaBuilding, FaClock, FaUsers, FaRegClock } from 'react-icons/fa';
import { getRooms, getBookingDetails, changeBookingRoom } from '../../services/api';

const ChangeRoomPage = () => {
  const navigate = useNavigate();
  const { bookingId } = useParams(); // Get booking ID from URL parameters
  
  // State cho booking hiện tại và dữ liệu phòng
  const [currentBooking, setCurrentBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [changeSuccess, setChangeSuccess] = useState(false);
  const [processingChange, setProcessingChange] = useState(false);
  const [canChangeRoom, setCanChangeRoom] = useState(true);
  const [restrictionReason, setRestrictionReason] = useState('');
  
  // State cho tìm kiếm và filter
  const [searchQuery, setSearchQuery] = useState('');
  const [rooms, setRooms] = useState([]);
  const [filters, setFilters] = useState({
    capacity: [],
    timeRange: [],
    duration: [],
    building: []
  });
  const [showUnavailableRooms, setShowUnavailableRooms] = useState(true);

  // Các tùy chọn filter giống với RoomSearchPage
  const buildingOptions = ['B1', 'H2', 'H3', 'H6'];
  const timeRangeOptions = ['7h - 9h', '9h - 11h', '11h - 13h', '13h - 15h', '15h - 17h', '17h - 19h', '19h - 21h'];
  const capacityOptions = [2, 5, 7];
  const durationOptions = ['1 tiếng', '2 tiếng', '3 tiếng', '4 tiếng'];

  // Format thời gian theo định dạng nhất quán với RoomSearchPage
  const formatTime = (isoTimeString) => {
    try {
      if (!isoTimeString) return 'N/A';
      
      // Loại bỏ ký hiệu múi giờ nếu có (Z hoặc +xx:xx)
      const localTimeString = isoTimeString.replace(/Z|[+-]\d{2}:\d{2}$/, '');
      
      const date = new Date(localTimeString);
      if (isNaN(date.getTime())) return isoTimeString;
      
      const day = date.getDate();
      const month = date.getMonth() + 1;
      const year = date.getFullYear();
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
  
      const weekdayIndex = date.getDay();
      const weekdays = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
      const weekday = weekdays[weekdayIndex];
  
      return `${weekday}, ${day}/${month}/${year} ${hours}:${minutes}`;
    } catch (err) {
      console.error('Error formatting date:', err);
      return isoTimeString || 'N/A';
    }
  };
  // Format khoảng thời gian giống với RoomSearchPage
  const formatTimeRange = (startTimeStr, endTimeStr) => {
    if (!startTimeStr || !endTimeStr) return 'Không có thông tin';
    
    try {
      const startTime = new Date(startTimeStr);
      const endTime = new Date(endTimeStr);
      
      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        return 'Thời gian không hợp lệ';
      }
      
      const startHours = startTime.getHours().toString().padStart(2, '0');
      const startMinutes = startTime.getMinutes().toString().padStart(2, '0');
      const endHours = endTime.getHours().toString().padStart(2, '0');
      const endMinutes = endTime.getMinutes().toString().padStart(2, '0');
      
      return `${startHours}:${startMinutes} - ${endHours}:${endMinutes}`;
    } catch (err) {
      console.error('Error formatting time range:', err);
      return 'Thời gian không hợp lệ';
    }
  };

  // Trích xuất khoảng giờ từ startTime và endTime để hiển thị giống với RoomSearchPage
  const extractTimeRangeForFilter = (startTimeStr, endTimeStr) => {
    if (!startTimeStr || !endTimeStr) return null;
    
    try {
      const startTime = new Date(startTimeStr);
      const endTime = new Date(endTimeStr);
      
      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        return null;
      }
      
      const startHour = startTime.getHours();
      const endHour = endTime.getHours();
      
      return `${startHour}h - ${endHour}h`;
    } catch (err) {
      console.error('Error extracting time range:', err);
      return null;
    }
  };

  // Fetch booking details và các phòng khả dụng khi component mount
  useEffect(() => {
    const fetchBookingAndRooms = async () => {
      try {
        setLoading(true);
        
        // Lấy thông tin booking hiện tại
        const bookingResponse = await getBookingDetails(bookingId);
        if (bookingResponse.success && bookingResponse.data) {
          setCurrentBooking(bookingResponse.data);
          
          // Kiểm tra tính hợp lệ của việc đổi phòng
          const bookingStatus = bookingResponse.data.bookingStatus;
          const isValidStatus = ['PENDING', 'CONFIRMED'].includes(bookingStatus);
          
          if (!isValidStatus) {
            setCanChangeRoom(false);
            setRestrictionReason(`Không thể đổi phòng khi trạng thái đặt phòng là: ${bookingStatus}`);
            setLoading(false);
            return;
          }
          
          // Trích xuất khoảng giờ đặt phòng hiện tại để áp dụng filter
          const timeRange = extractTimeRangeForFilter(
            bookingResponse.data.startTime, 
            bookingResponse.data.endTime
          );
          
          // Tự động đặt timeRange từ booking hiện tại
          if (timeRange) {
            setFilters(prev => ({
              ...prev,
              timeRange: [timeRange]
            }));
          }
          
          // Lấy danh sách phòng khả dụng cùng thời gian
          const roomsResponse = await getRooms({
            startTime: bookingResponse.data.startTime,
            endTime: bookingResponse.data.endTime,
            date: new Date(bookingResponse.data.startTime).toISOString().split('T')[0]
          });
          
          if (roomsResponse.success) {
            setRooms(roomsResponse.data);
          } else {
            setError('Không thể tải danh sách phòng');
          }
        } else {
          setError('Không tìm thấy thông tin đặt phòng');
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Đã xảy ra lỗi khi tải dữ liệu. Vui lòng thử lại sau.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchBookingAndRooms();
  }, [bookingId]);

  // Xử lý thay đổi ô tìm kiếm
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };
  
  const handleSearchSubmit = () => {
    // Hiện tại chỉ lọc client-side, có thể mở rộng để gọi API search nếu cần
  };
  
  // Xử lý thay đổi filter
  const handleFilterChange = (category, value) => {
    setFilters(prevFilters => {
      const updatedFilters = {...prevFilters};
      
      if (updatedFilters[category].includes(value)) {
        // Nếu đã có trong filter, loại bỏ
        updatedFilters[category] = updatedFilters[category].filter(item => item !== value);
      } else {
        // Nếu chưa có trong filter, thêm vào
        updatedFilters[category] = [...updatedFilters[category], value];
      }
      
      return updatedFilters;
    });
  };
  
  // Lọc phòng dựa trên từ khóa tìm kiếm và bộ lọc
  const filteredRooms = rooms.filter(room => {
    // Lọc theo từ khóa tìm kiếm
    if (searchQuery && !room.name?.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !room.location?.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !room.description?.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !room.building?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    // Lọc theo tòa nhà
    if (filters.building.length > 0 && !filters.building.includes(room.building)) {
      return false;
    }
    
    // Lọc theo sức chứa
    if (filters.capacity.length > 0) {
      let capacityMatch = false;
      for (const cap of filters.capacity) {
        if (room.capacity >= parseInt(cap)) {
          capacityMatch = true;
          break;
        }
      }
      if (!capacityMatch) return false;
    }
    
    // Loại trừ phòng hiện tại khỏi kết quả
    if (currentBooking && room.id === currentBooking.roomId) {
      return false;
    }
    
    return true;
  });

  // Hiển thị phòng dựa theo filter khả dụng như trong RoomSearchPage
  const displayedRooms = filters.timeRange.length > 0 && !showUnavailableRooms
    ? filteredRooms.filter(room => room.isAvailableForTimeRange !== false)
    : filteredRooms;
  
  // Xử lý yêu cầu đổi phòng
  const handleChangeRoom = async (newRoomId) => {
    try {
      if (!currentBooking || !newRoomId) return;
      
      setProcessingChange(true);
      const response = await changeBookingRoom(currentBooking.id, newRoomId);
      
      if (response.success) {
        setChangeSuccess(true);
      } else {
        setError(response.error || 'Không thể đổi phòng. Vui lòng thử lại sau.');
      }
    } catch (err) {
      console.error('Error changing room:', err);
      setError('Đã xảy ra lỗi khi đổi phòng. Vui lòng thử lại sau.');
    } finally {
      setProcessingChange(false);
    }
  };

  // Xử lý quay lại trang Phòng của tôi
  const handleMyRooms = () => {
    navigate('/myroom');
  };

  // Hiển thị khi đang tải
  if (loading) {
    return (
      <div className="changeroom-page">
        <Header />
        <div className="changeroom-wrapper">
          <div className="changeroom-loading">Đang tải thông tin...</div>
        </div>
      </div>
    );
  }

  // Hiển thị khi có lỗi
  if (error && !currentBooking) {
    return (
      <div className="changeroom-page">
        <Header />
        <div className="changeroom-wrapper">
          <div className="changeroom-error">
            <h3>Đã xảy ra lỗi</h3>
            <p>{error}</p>
            <button className="changeroom-back-btn" onClick={handleMyRooms}>
              Quay lại Phòng của tôi
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Hiển thị khi đổi phòng thành công
  if (changeSuccess) {
    return (
      <div className="changeroom-page">
        <Header />
        <div className="changeroom-wrapper">
          <div className="changeroom-success">
            <h3>Đổi phòng thành công!</h3>
            <p>Thông tin đặt phòng mới của bạn đã được cập nhật.</p>
            <button className="changeroom-back-btn" onClick={handleMyRooms}>
              Xem Phòng của tôi
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="changeroom-page">
      <Header />
      
      <div className="changeroom-wrapper">
        {/* Current booking information */}
        <div className="changeroom-current-booking">
          <div className="changeroom-back-button-container">
            <button className="changeroom-back-button" onClick={handleMyRooms}>
              <FaArrowLeft /> Quay lại Phòng của tôi
            </button>
          </div>
          
          <h2>Thông tin đặt phòng hiện tại</h2>
          
          {currentBooking && (
            <div className="changeroom-current-room-card">
              <div className="changeroom-room-image">
                <img 
                  src={
                    currentBooking.roomImage
                      ? `http://localhost:5000${currentBooking.roomImage}`
                      : require('../../assets/room-main.png')
                  } 
                  alt={currentBooking.roomName || 'Room image'} 
                />
              </div>
              <div className="changeroom-room-details">
                <h3>{currentBooking.roomName || `Phòng ${currentBooking.roomId}`}</h3>
                <div className="changeroom-room-specs">
                  <div className="changeroom-room-meta">
                    <span><FaCalendar /> Bắt đầu: {formatTime(currentBooking.startTime)}</span>
                    <span><FaCalendar /> Kết thúc: {formatTime(currentBooking.endTime)}</span>
                  </div>
                  <div className="changeroom-room-meta">
                    <span><FaUser /> Sức chứa: {currentBooking.attendeesCount} người</span>
                    <span><FaRulerCombined /> Trạng thái: {currentBooking.bookingStatus}</span>
                  </div>
                </div>
                
                {restrictionReason && (
                  <div className="changeroom-restriction-notice">
                    <FaExclamationTriangle className="changeroom-warning-icon" />
                    <p>{restrictionReason}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
        {canChangeRoom ? (
          <div className="changeroom-content">
            <aside className="changeroom-sidebar">
              <div className="changeroom-search-bar">
                <FaSearch className="changeroom-search-icon" />
                <input
                  type="text"
                  placeholder="Tìm phòng theo tên, vị trí..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearchSubmit()}
                  className="changeroom-search-input"
                />
              </div>

              <h4>Bộ lọc</h4>

              <div className="changeroom-filter-group">
                <h5><FaCalendar /> Ngày</h5>
                <div className="changeroom-date-selector">
                  <input 
                    type="date"
                    value={currentBooking ? new Date(currentBooking.startTime).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}
                    disabled
                    className="changeroom-date-input"
                  />
                </div>
              </div>

              <div className="changeroom-filter-group">
                <h5><FaBuilding /> Tòa nhà</h5>
                {buildingOptions.map((building) => (
                  <label key={building}>
                    <input 
                      type="checkbox" 
                      onChange={() => handleFilterChange('building', building)} 
                      checked={filters.building?.includes(building)}
                    /> {building}
                  </label>
                ))}
              </div>

              <div className="changeroom-filter-group">
                <h5><FaClock /> Khoảng giờ</h5>
                {timeRangeOptions.map((t) => (
                  <label key={t}>
                    <input 
                      type="checkbox"
                      onChange={() => handleFilterChange('timeRange', t)} 
                      checked={filters.timeRange?.includes(t)}
                    /> {t}
                  </label>
                ))}
                
                {filters.timeRange.length > 0 && (
                  <div className="changeroom-availability-toggle">
                    <label>
                      <input 
                        type="checkbox"
                        checked={showUnavailableRooms}
                        onChange={() => setShowUnavailableRooms(!showUnavailableRooms)}
                      /> Hiển thị cả phòng không khả dụng
                    </label>
                  </div>
                )}
              </div>

              <div className="changeroom-filter-group">
                <h5><FaUsers /> Số lượng người</h5>
                {capacityOptions.map((c) => (
                  <label key={c}>
                    <input 
                      type="checkbox" 
                      onChange={() => handleFilterChange('capacity', c)} 
                      checked={filters.capacity?.includes(c)}
                    /> {c} người
                  </label>
                ))}
              </div>

              <div className="changeroom-filter-group">
                <h5><FaRegClock /> Thời lượng sử dụng</h5>
                {durationOptions.map((d) => (
                  <label key={d}>
                    <input 
                      type="checkbox" 
                      onChange={() => handleFilterChange('duration', d)} 
                      checked={filters.duration?.includes(d)}
                    /> {d}
                  </label>
                ))}
              </div>
            </aside>

            <section className="changeroom-room-listing">
              <h3>Phòng khả dụng cho thời gian đã chọn</h3>
              <p className="changeroom-result-count">{filteredRooms.length} kết quả được tìm thấy</p>
              
              {processingChange ? (
                <div className="changeroom-processing">Đang xử lý yêu cầu đổi phòng...</div>
              ) : error ? (
                <div className="changeroom-error-message">{error}</div>
              ) : filteredRooms.length === 0 ? (
                <div className="changeroom-no-results">
                  Không tìm thấy phòng phù hợp. Vui lòng thử lại với bộ lọc khác.
                </div>
              ) : (
                <div className="changeroom-room-grid">
                  {displayedRooms.map((room) => (
                    <div key={room.id} className="changeroom-room-card-modern">
                      <img 
                        src={
                          room.roomImage
                            ? `http://localhost:5000${room.roomImage}`
                            : require('../../assets/room-main.png')
                        } 
                        alt={room.name} 
                      />
                      <div className="changeroom-card-body">
                        <div>
                          <h4>{room.name}</h4>
                          <p className="changeroom-location">{room.location || room.building}</p>
                          <p className="changeroom-description">{room.description || `Phòng số ${room.id}`}</p>
                          
                          <div className="changeroom-room-meta">
                            <span><FaUser /> {room.capacity} người</span>
                            <span><FaRulerCombined /> {room.area} m²</span>
                          </div>
                          
                          <p className="changeroom-room-amenities">
                            Tiện nghi: {typeof room.facilities === 'string' 
                              ? room.facilities 
                              : Array.isArray(room.facilities) 
                                ? room.facilities.join(', ') 
                                : 'Không có thông tin'}
                          </p>
                          
                          {filters.timeRange.length > 0 && (
                            <div className="changeroom-time-info">
                              <p className={`room-availability ${room.isAvailableForTimeRange !== false ? 'available' : 'unavailable'}`}>
                                {room.isAvailableForTimeRange !== false ? 'Khả dụng' : 'Không khả dụng'} trong khoảng giờ {filters.timeRange[0]}
                              </p>
                            </div>
                          )}
                        </div>
                        
                        <button 
                          className="changeroom-book-btn" 
                          onClick={() => handleChangeRoom(room.id)}
                          disabled={processingChange}
                        >
                          Đổi sang phòng này
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="changeroom-restriction-container">
            <p>Không thể đổi phòng tại thời điểm này.</p>
            <button className="changeroom-back-btn" onClick={handleMyRooms}>
              Quay lại Phòng của tôi
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChangeRoomPage;