const db = require('../config/connect_db');

class Room {
    constructor(id, name, location, floor, building, capacity, area, roomType, roomImage, description, facilities, openingHours, status) {
        this.id = id;
        this.name = name;
        this.location = location;
        this.floor = floor;
        this.building = building;
        this.capacity = capacity;
        this.area = area;
        this.roomType = roomType;
        this.roomImage = roomImage;
        this.description = description;
        this.facilities = facilities;
        this.openingHours = openingHours;
        this.status = status || 'AVAILABLE';
    }

    /**
     * Save a new room to the database
     * @returns {Promise<Object>} - Created room
     */
    async save() {
        try {
            const query = `
                INSERT INTO room (
                    name, location, floor, building, capacity, 
                    area, room_type, room_image, description, 
                    facilities, opening_hours, status
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            `;
            
            const [result] = await db.execute(query, [
                this.name,
                this.location,
                this.floor,
                this.building,
                this.capacity,
                this.area,
                this.roomType,
                this.roomImage,
                this.description,
                JSON.stringify(this.facilities),
                this.openingHours,
                this.status
            ]);
            
            if (result.affectedRows === 0) {
                throw new Error('Failed to create room');
            }
            
            return { ...this, id: result.insertId };
        } catch (error) {
            console.error('Error saving room:', error);
            throw error;
        }
    }

    /**
     * Update an existing room
     * @returns {Promise<Object>} - Updated room
     */
    async update() {
        try {
            const query = `
                UPDATE room
                SET name = ?, location = ?, floor = ?, building = ?, capacity = ?,
                    area = ?, room_type = ?, room_image = ?, description = ?,
                    facilities = ?, opening_hours = ?, status = ?
                WHERE room_id = ?;
            `;
            
            const [result] = await db.execute(query, [
                this.name,
                this.location,
                this.floor,
                this.building,
                this.capacity,
                this.area,
                this.roomType,
                this.roomImage,
                this.description,
                JSON.stringify(this.facilities),
                this.openingHours,
                this.status,
                this.id
            ]);
            
            if (result.affectedRows === 0) {
                throw new Error('No room found with the given ID');
            }
            
            return this;
        } catch (error) {
            console.error('Error updating room:', error);
            throw error;
        }
    }

    /**
     * Find a room by ID
     * @param {number|string} id - Room ID
     * @returns {Promise<Room|null>} - Room object or null if not found
     */
    static async findRoomById(id) {
        try {
            const query = `
                SELECT * FROM room
                WHERE room_id = ?;
            `;
            
            const [rows] = await db.execute(query, [id]);
            
            if (rows.length === 0) {
                return null;
            }
            
            const room = rows[0];
            const facilities = typeof room.facilities === 'string' ? JSON.parse(room.facilities) : room.facilities;
            
            return new Room(
                room.room_id,
                room.name,
                room.location,
                room.floor,
                room.building,
                room.capacity,
                room.area,
                room.room_type,
                room.room_image,
                room.description,
                facilities,
                room.opening_hours,
                room.status
            );
        } catch (error) {
            console.error('Error finding room by ID:', error);
            throw error;
        }
    }

    /**
     * Find all rooms with optional filtering
     * @param {Object} filters - Optional filters
     * @returns {Promise<Array<Room>>} - Array of room objects
     */
    static async findAll(filters = {}) {
        try {
            let query = `
                SELECT * FROM room
                WHERE 1=1
            `;
            
            const params = [];
            
            if (filters.capacity) {
                query += ` AND capacity >= ?`;
                params.push(filters.capacity);
            }
            
            if (filters.area) {
                query += ` AND area >= ?`;
                params.push(filters.area);
            }
            
            if (filters.status) {
                query += ` AND status = ?`;
                params.push(filters.status);
            }
            
            if (filters.building) {
                query += ` AND building = ?`;
                params.push(filters.building);
            }
            
            if (filters.floor) {
                query += ` AND floor = ?`;
                params.push(filters.floor);
            }
            
            if (filters.roomType) {
                query += ` AND room_type = ?`;
                params.push(filters.roomType);
            }
            
            // Cải thiện date filter để chỉ lọc theo chồng chéo thời gian, không lọc theo ngày
            if ((filters.date && filters.startTime && filters.endTime) || 
                (filters.startTime && filters.endTime)) {
                
                // Chuẩn hóa datetime
                let fullStartTime = filters.startTime;
                let fullEndTime = filters.endTime;
                
                if (filters.date) {
                    fullStartTime = `${filters.date}T${filters.startTime}`;
                    fullEndTime = `${filters.date}T${filters.endTime}`;
                }
                
                let bookingOverlapQuery = `
                    AND room_id NOT IN (
                        SELECT room_id FROM booking
                        WHERE booking_status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN')
                `;
                
                // Nếu có excludeBookingId, thêm điều kiện để loại trừ booking hiện tại
                if (filters.excludeBookingId) {
                    bookingOverlapQuery += ` AND booking_id != ? `;
                    params.push(filters.excludeBookingId);
                }
                
                bookingOverlapQuery += `
                        AND (
                            (start_time < ? AND end_time > ?) OR
                            (start_time < ? AND end_time > ?) OR
                            (start_time >= ? AND end_time <= ?)
                        )
                    )
                `;
                
                query += bookingOverlapQuery;
                
                params.push(
                    fullEndTime, fullStartTime,      // Kiểm tra booking kết thúc sau khi thời gian mới bắt đầu
                    fullStartTime, fullStartTime,    // Kiểm tra booking bắt đầu trước khi thời gian mới kết thúc
                    fullStartTime, fullEndTime       // Kiểm tra booking nằm hoàn toàn trong khoảng thời gian mới
                );
                
                console.log("Using time filter with overlap check");
                if (filters.excludeBookingId) {
                    console.log(`Excluding booking ID: ${filters.excludeBookingId} from availability check`);
                }
            } 
            // Nếu chỉ có date mà không có startTime, endTime (backwards compatibility)
            else if (filters.date) {
                console.log('Using legacy date filter without time range');
                query += `
                    AND room_id NOT IN (
                        SELECT room_id FROM booking
                        WHERE DATE(start_time) = DATE(?)
                        AND booking_status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN')
                `;
                
                // Nếu có excludeBookingId, thêm điều kiện để loại trừ booking hiện tại
                if (filters.excludeBookingId) {
                    query += ` AND booking_id != ? `;
                    params.push(filters.excludeBookingId);
                }
                
                query += `)`;
                params.push(filters.date);
            }
            
            query += ` ORDER BY name ASC`;
            
            const [rows] = await db.execute(query, params);
            
            return rows.map(room => {
                const facilities = typeof room.facilities === 'string' ? JSON.parse(room.facilities) : room.facilities;
                
                return new Room(
                    room.room_id,
                    room.name,
                    room.location,
                    room.floor,
                    room.building,
                    room.capacity,
                    room.area,
                    room.room_type,
                    room.room_image,
                    room.description,
                    facilities,
                    room.opening_hours,
                    room.status
                );
            });
        } catch (error) {
            console.error('Error finding rooms:', error);
            throw error;
        }
    }

    /**
     * Search rooms by keyword
     * @param {string} keyword - Search keyword
     * @returns {Promise<Array<Room>>} - Array of room objects
     */
    static async searchByKeyword(keyword) {
        try {
            const query = `
                SELECT * FROM room
                WHERE name LIKE ? OR description LIKE ? OR location LIKE ?
                ORDER BY name ASC;
            `;
            
            const searchParam = `%${keyword}%`;
            const [rows] = await db.execute(query, [searchParam, searchParam, searchParam]);
            
            return rows.map(room => {
                const facilities = typeof room.facilities === 'string' ? JSON.parse(room.facilities) : room.facilities;
                
                return new Room(
                    room.room_id,
                    room.name,
                    room.location,
                    room.floor,
                    room.building,
                    room.capacity,
                    room.area,
                    room.room_type,
                    room.room_image,
                    room.description,
                    facilities,
                    room.opening_hours,
                    room.status
                );
            });
        } catch (error) {
            console.error('Error searching rooms:', error);
            throw error;
        }
    }

    /**
     * Check if a time period is within room opening hours
     * @param {string|Array} openingHours - Opening hours in JSON format or parsed array
     * @param {string} startTime - Start time to check
     * @param {string} endTime - End time to check
     * @returns {boolean} - True if the time period is within opening hours
     */
    static isWithinOpeningHours(openingHours, startTime, endTime) {
        try {
            // Kiểm tra tham số đầu vào
            if (!startTime || !endTime) {
                console.log('Missing startTime or endTime in isWithinOpeningHours, defaulting to available');
                return true;
            }
            
            // Nếu không có thông tin giờ mở cửa, mặc định phòng khả dụng
            if (!openingHours) {
                console.log('No opening hours defined for room, defaulting to available');
                return true;
            }

            // Nếu openingHours là một chuỗi rỗng, mặc định phòng khả dụng
            if (typeof openingHours === 'string' && openingHours.trim() === '') {
                console.log('Empty opening hours string, defaulting to available');
                return true;
            }

            // Parse opening hours if needed
            let timeRanges;
            try {
                timeRanges = typeof openingHours === 'string' ? JSON.parse(openingHours) : openingHours;
            } catch (parseError) {
                console.log('Error parsing opening hours, defaulting to available:', parseError);
                return true;
            }
            
            // Trường hợp không có dữ liệu sau khi parse
            if (!timeRanges || (Array.isArray(timeRanges) && timeRanges.length === 0)) {
                console.log('No valid opening hours data, defaulting to available');
                return true;
            }
            
            // Xử lý chuỗi thời gian
            // Trích xuất giờ từ tham số đầu vào, hỗ trợ nhiều định dạng thời gian
            let requestStartHour = 0;
            let requestStartMinute = 0;
            let requestEndHour = 0;
            let requestEndMinute = 0;
            
            // Định dạng hàm để trích xuất thời gian từ các dạng chuỗi khác nhau
            const extractTimeComponents = (timeString) => {
                // Support Date object input
                if (timeString instanceof Date) {
                    const hours = timeString.getUTCHours();
                    const minutes = timeString.getUTCMinutes();
                    console.log(`Parsed Date object to hours:minutes = ${hours}:${minutes}`);
                    return { hour: hours, minute: minutes };
                }
                if (typeof timeString !== 'string') {
                    console.error('Invalid time string format:', timeString);
                    return { hour: 0, minute: 0 };
                }
                
                // Xử lý ISO datetime bằng regex trước tiên cho các định dạng phổ biến
                // Hỗ trợ định dạng ISO với Z (UTC) như: 2025-05-09T11:00:00.000Z
                const isoWithZPattern = /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?Z/;
                const isoWithZMatch = timeString.match(isoWithZPattern);
                
                if (isoWithZMatch) {
                    const hours = parseInt(isoWithZMatch[4], 10);
                    const minutes = parseInt(isoWithZMatch[5], 10);
                    console.log(`Parsed ISO with Z: ${timeString} to hours:minutes = ${hours}:${minutes}`);
                    return { hour: hours, minute: minutes };
                }
                
                // Backup: Sử dụng Date object để xử lý
                try {
                    const date = new Date(timeString);
                    if (!isNaN(date.getTime())) {
                        const hours = date.getUTCHours();
                        const minutes = date.getUTCMinutes();
                        console.log(`Successfully parsed ISO datetime ${timeString} to UTC hours:minutes = ${hours}:${minutes}`);
                        return { hour: hours, minute: minutes };
                    }
                } catch (dateError) {
                    console.error('Error parsing date object:', dateError);
                }
                
                // Phương án dự phòng: sử dụng regex để phân tích chuỗi ISO
                const isoPattern = /(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/;
                const isoMatch = timeString.match(isoPattern);
                
                if (isoMatch) {
                    const hours = parseInt(isoMatch[4], 10);
                    const minutes = parseInt(isoMatch[5], 10);
                    console.log(`Parsed ISO string ${timeString} to hours:minutes = ${hours}:${minutes}`);
                    return { hour: hours, minute: minutes };
                }
                
                // Trường hợp chỉ có giờ: "17:00" hoặc "17:00:00"
                const timePattern = /(\d{1,2}):(\d{2})(?::(\d{2}))?/;
                const timeMatch = timeString.match(timePattern);
                
                if (timeMatch) {
                    const hours = parseInt(timeMatch[1], 10);
                    const minutes = parseInt(timeMatch[2], 10);
                    console.log(`Parsed time string ${timeString} to hours:minutes = ${hours}:${minutes}`);
                    return { hour: hours, minute: minutes };
                }
                
                console.error('Unrecognized time format:', timeString);
                return { hour: 0, minute: 0 };
            };
            
            // Trích xuất giờ và phút từ chuỗi thời gian
            const startTimeComponents = extractTimeComponents(startTime);
            const endTimeComponents = extractTimeComponents(endTime);
            
            requestStartHour = startTimeComponents.hour;
            requestStartMinute = startTimeComponents.minute;
            requestEndHour = endTimeComponents.hour;
            requestEndMinute = endTimeComponents.minute;
            
            console.log(`Extracted time for availability check: ${requestStartHour}:${requestStartMinute} - ${requestEndHour}:${requestEndMinute}`);
            
            // Kiểm tra định dạng thời gian mở cửa cũ (string với dấu -)
            if (typeof openingHours === 'string' && openingHours.includes('-')) {
                const [rangeStart, rangeEnd] = openingHours.split('-');
                return this.isTimeInRange(
                    `${requestStartHour}:${requestStartMinute}`,
                    `${requestEndHour}:${requestEndMinute}`,
                    rangeStart,
                    rangeEnd
                );
            }
            
            // Kiểm tra các khung giờ hoạt động
            if (Array.isArray(timeRanges)) {
                // Phòng khả dụng 24/7 nếu không có chi tiết về giờ mở cửa
                if (timeRanges.length === 0) {
                    console.log('No time ranges specified, assuming room is available 24/7');
                    return true;
                }
                
                for (const range of timeRanges) {
                    if (!range.start || !range.end) {
                        console.log('Invalid range format:', range);
                        continue;
                    }
                    
                    // Chuẩn hoá giờ mở cửa và đóng cửa
                    let rangeStartHour, rangeStartMinute, rangeEndHour, rangeEndMinute;
                    
                    try {
                        [rangeStartHour, rangeStartMinute] = range.start.split(':').map(Number);
                        [rangeEndHour, rangeEndMinute] = range.end.split(':').map(Number);
                    } catch (error) {
                        console.log('Error parsing time range, skipping:', error);
                        continue;
                    }
                    
                    if (isNaN(rangeStartHour) || isNaN(rangeStartMinute) || isNaN(rangeEndHour) || isNaN(rangeEndMinute)) {
                        console.log('Invalid time format in range:', range);
                        continue;
                    }
                    
                    console.log(`Comparing with opening hours: ${rangeStartHour}:${rangeStartMinute} - ${rangeEndHour}:${rangeEndMinute}`);
                    
                    // Kiểm tra thời gian bắt đầu
                    const startInRange = (
                        (requestStartHour > rangeStartHour) || 
                        (requestStartHour === rangeStartHour && requestStartMinute >= rangeStartMinute)
                    ) && (
                        (requestStartHour < rangeEndHour) || 
                        (requestStartHour === rangeEndHour && requestStartMinute <= rangeEndMinute)
                    );
                    
                    // Kiểm tra thời gian kết thúc
                    const endInRange = (
                        (requestEndHour > rangeStartHour) || 
                        (requestEndHour === rangeStartHour && requestEndMinute >= rangeStartMinute)
                    ) && (
                        (requestEndHour < rangeEndHour) || 
                        (requestEndHour === rangeEndHour && requestEndMinute <= rangeEndMinute)
                    );
                    
                    console.log(`Start time in range: ${startInRange}, End time in range: ${endInRange}`);
                    
                    // Cả thời gian bắt đầu và kết thúc phải nằm trong cùng một khoảng
                    if (startInRange && endInRange) {
                        console.log('Time range is within opening hours!');
                        return true;
                    }
                }
                
                console.log('Time range is NOT within opening hours!');
                return false;
            }
            
            // Nếu không tìm thấy định dạng giờ mở cửa hợp lệ, mặc định cho phòng khả dụng
            console.log('Unknown opening hours format, defaulting to available');
            return true;
        } catch (error) {
            console.error('Error in isWithinOpeningHours:', error);
            // Trong trường hợp có lỗi, mặc định cho phòng khả dụng
            return true;
        }
    }

    /**
     * Helper function to check if a time is within a range
     */
    static isTimeInRange(startTime, endTime, rangeStart, rangeEnd) {
        try {
            // Kiểm tra tham số
            if (!startTime || !endTime || !rangeStart || !rangeEnd) {
                console.log('Missing parameters in isTimeInRange, defaulting to available');
                return true;
            }

            // Extract just the time portion if we have full datetime strings
            const extractTimeOnly = (dateTimeStr) => {
                try {
                    if (typeof dateTimeStr !== 'string') {
                        console.error('Invalid datetime string:', dateTimeStr);
                        return '00:00'; // Fallback
                    }
                    
                    // Xử lý định dạng ISO datetime với Date object
                    try {
                        const date = new Date(dateTimeStr);
                        if (!isNaN(date.getTime())) {
                            console.log(`Successfully parsed ${dateTimeStr} to time: ${date.getUTCHours()}:${date.getUTCMinutes()}`);
                            return `${date.getUTCHours().toString().padStart(2, '0')}:${date.getUTCMinutes().toString().padStart(2, '0')}`;
                        }
                    } catch (err) {
                        console.error('Error parsing date in extractTimeOnly:', err);
                    }
                    
                    // Nếu có dấu T hoặc dấu - là ISO format
                    if (dateTimeStr.includes('T') || (dateTimeStr.includes('-') && dateTimeStr.includes(':'))) {
                        const match = dateTimeStr.match(/(\d{2}):(\d{2})/);
                        if (match) {
                            return `${match[1]}:${match[2]}`;
                        }
                    }
                    
                    // Nếu là định dạng chỉ có thời gian (HH:MM)
                    if (dateTimeStr.includes(':')) {
                        const parts = dateTimeStr.split(':');
                        const hours = parts[0].padStart(2, '0');
                        const minutes = (parts[1] || '00').padStart(2, '0');
                        return `${hours}:${minutes}`;
                    }
                    
                    return dateTimeStr;
                } catch (e) {
                    console.error('Error in extractTimeOnly:', e);
                    return '00:00'; // Fallback
                }
            };
            
            const start = extractTimeOnly(startTime);
            const end = extractTimeOnly(endTime);
            
            // Chuẩn hóa các chuỗi thời gian
            const normalizeTime = (timeStr) => {
                if (!timeStr || typeof timeStr !== 'string') return '00:00';
                
                // Handle format without ':' like '700' or '7' -> '07:00'
                if (!timeStr.includes(':')) {
                    if (timeStr.length <= 2) {
                        return `${timeStr.padStart(2, '0')}:00`;
                    } else {
                        const hour = timeStr.slice(0, -2).padStart(2, '0');
                        const minute = timeStr.slice(-2).padStart(2, '0');
                        return `${hour}:${minute}`;
                    }
                }
                
                // Handle format with ':' like '7:00' -> '07:00'
                const parts = timeStr.split(':');
                if (parts.length === 2) {
                    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
                }
                
                return timeStr;
            };
            
            const normalizedStart = normalizeTime(start);
            const normalizedEnd = normalizeTime(end);
            const normalizedRangeStart = normalizeTime(rangeStart);
            const normalizedRangeEnd = normalizeTime(rangeEnd);
            
            console.log(`Comparing time range: ${normalizedStart} - ${normalizedEnd} with opening hours: ${normalizedRangeStart} - ${normalizedRangeEnd}`);
            
            // Nếu thời gian bắt đầu và kết thúc nằm trong khoảng giờ mở cửa
            const isWithinRange = normalizedStart >= normalizedRangeStart && normalizedEnd <= normalizedRangeEnd;
            
            console.log(`Time is ${isWithinRange ? 'within' : 'NOT within'} range`);
            return isWithinRange;
        } catch (error) {
            console.error('Error in isTimeInRange:', error);
            return true; // Nếu có lỗi, mặc định là phòng khả dụng
        }
    }

    /**
     * Check if a room is available for a specific time period
     * @param {number|string} roomId - Room ID
     * @param {string} startTime - Start date and time
     * @param {string} endTime - End date and time
     * @param {number|string} excludeBookingId - Booking ID to exclude from check (optional)
     * @returns {Promise<boolean>} - True if room is available, false otherwise
     */
    static async checkAvailability(roomId, startTime, endTime, excludeBookingId = null) {
        try {
            // First check if the requested time is in the past
            const now = new Date();
            const requestStartTime = new Date(startTime);
            
            if (requestStartTime < now) {
                console.log(`Room ${roomId} is not available - requested time (${startTime}) is in the past`);
                return false; // Cannot book for a time that has already passed
            }
            
            // First check if room exists and is available
            const roomQuery = `
                SELECT * FROM room
                WHERE room_id = ? AND status = 'AVAILABLE';
            `;
            
            const [roomRows] = await db.execute(roomQuery, [roomId]);
            
            if (roomRows.length === 0) {
                console.log(`Room ${roomId} does not exist or is not available`);
                return false; // Room doesn't exist or is not available
            }
            
            const room = roomRows[0];
            
            // Debug log
            console.log(`Checking availability for room ${roomId}:`, {
                requestedStartTime: startTime,
                requestedEndTime: endTime,
                roomStatus: room.status,
                excludeBookingId: excludeBookingId
            });
            
            // Check if the requested time falls within opening hours
            const isWithinHours = this.isWithinOpeningHours(room.opening_hours, startTime, endTime);
            if (!isWithinHours) {
                console.log(`Room ${roomId} is not available - outside opening hours`);
                return false; // Not within opening hours
            }
            
            // Check if there are any overlapping bookings
            // Chỉ kiểm tra chồng chéo thời gian một cách chính xác
            let bookingQuery = `
                SELECT * FROM booking
                WHERE room_id = ?
                  AND booking_status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN')
            `;
            
            const queryParams = [roomId];
            
            // Nếu có excludeBookingId, thêm điều kiện loại trừ booking hiện tại
            if (excludeBookingId) {
                bookingQuery += ` AND booking_id != ?`;
                queryParams.push(excludeBookingId);
            }
            
            bookingQuery += `
                  AND (
                      (start_time < ? AND end_time > ?) OR  /* Booking kết thúc sau khi yêu cầu mới bắt đầu */
                      (start_time < ? AND end_time > ?) OR  /* Booking bắt đầu trước khi yêu cầu mới kết thúc */
                      (start_time >= ? AND end_time <= ?)   /* Booking nằm hoàn toàn trong khoảng thời gian yêu cầu mới */
                  );
            `;
            
            // Thêm các tham số cho điều kiện chồng chéo thời gian
            queryParams.push(
                startTime, startTime,  /* Kiểm tra trường hợp 1: booking hiện tại kết thúc sau khi booking mới bắt đầu */
                endTime, endTime,      /* Kiểm tra trường hợp 2: booking hiện tại bắt đầu trước khi booking mới kết thúc */
                startTime, endTime     /* Kiểm tra trường hợp 3: booking hiện tại hoàn toàn nằm trong booking mới */
            );
            
            const [bookingRows] = await db.execute(bookingQuery, queryParams);
            
            if (bookingRows.length > 0) {
                console.log(`Room ${roomId} is not available - overlapping bookings found:`, 
                    bookingRows.map(b => `${new Date(b.start_time).toLocaleString()} - ${new Date(b.end_time).toLocaleString()}`));
                return false; // Overlapping bookings found
            }
            
            // If there are no overlapping bookings, the room is available
            console.log(`Room ${roomId} is available for the requested time`);
            return true;
        } catch (error) {
            console.error('Error checking room availability:', error);
            throw error;
        }
    }

    /**
     * Get available rooms for a specific time period
     * @param {string} startTime - Start date and time
     * @param {string} endTime - End date and time
     * @param {Object} filters - Additional filters
     * @returns {Promise<Array<Room>>} - Array of available rooms
     */
    static async getAvailableRooms(startTime, endTime, filters = {}) {
        try {
            // Kiểm tra nếu thời gian đã qua
            const now = new Date();
            const requestStartTime = new Date(startTime);
            
            // Nếu thời gian bắt đầu đã qua, trả về mảng rỗng
            if (requestStartTime < now) {
                console.log(`Requested start time (${startTime}) is in the past. No rooms available.`);
                return [];
            }
            
            // Start with general filters
            let query = `
                SELECT r.* FROM room r
                WHERE r.status = 'AVAILABLE'
            `;
            
            const params = [];
            
            // Add capacity filter if provided
            if (filters.capacity) {
                query += ` AND r.capacity >= ?`;
                params.push(filters.capacity);
            }
            
            // Add area filter if provided
            if (filters.area) {
                query += ` AND r.area >= ?`;
                params.push(filters.area);
            }
            
            // Add building filter if provided
            if (filters.building) {
                query += ` AND r.building = ?`;
                params.push(filters.building);
            }
            
            // Add floor filter if provided
            if (filters.floor) {
                query += ` AND r.floor = ?`;
                params.push(filters.floor);
            }
            
            // Add room type filter if provided
            if (filters.roomType) {
                query += ` AND r.room_type = ?`;
                params.push(filters.roomType);
            }
            
            // Cải thiện cách kiểm tra chồng chéo booking - kiểm tra đúng sự chồng chéo thời gian
            query += `
                AND NOT EXISTS (
                    SELECT 1 FROM booking b
                    WHERE b.room_id = r.room_id
                      AND b.booking_status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN')
                      AND (
                          (b.start_time < ? AND b.end_time > ?) OR  /* Booking kết thúc sau khi thời gian mới bắt đầu */
                          (b.start_time < ? AND b.end_time > ?) OR  /* Booking bắt đầu trước khi thời gian mới kết thúc */
                          (b.start_time >= ? AND b.end_time <= ?)   /* Booking nằm hoàn toàn trong khoảng thời gian mới */
                      )
                )
                ORDER BY r.name ASC;
            `;
            
            params.push(
                startTime, startTime,  /* Kiểm tra trường hợp 1 */
                endTime, endTime,      /* Kiểm tra trường hợp 2 */
                startTime, endTime     /* Kiểm tra trường hợp 3 */
            );
            
            const [rows] = await db.execute(query, params);
            
            return rows.map(room => {
                const facilities = typeof room.facilities === 'string' ? JSON.parse(room.facilities) : room.facilities;
                
                return new Room(
                    room.room_id,
                    room.name,
                    room.location,
                    room.floor,
                    room.building,
                    room.capacity,
                    room.area,
                    room.room_type,
                    room.room_image,
                    room.description,
                    facilities,
                    room.opening_hours,
                    room.status
                );
            });
        } catch (error) {
            console.error('Error getting available rooms:', error);
            throw error;
        }
    }

    /**
     * Update room status based on the maintenance status of its devices
     * @param {number|string} roomId - Room ID
     * @returns {Promise<boolean>} - True if room status was updated
     */
    static async updateRoomStatusBasedOnDevices(roomId) {
        try {
            // Get all devices in the room
            const deviceModel = require('./device.model');
            const devices = await deviceModel.findAllDeviceOfRoom(roomId);
            
            // Get the room
            const room = await this.findRoomById(roomId);
            if (!room) {
                console.log(`Room ${roomId} not found`);
                return false;
            }
            
            // Check if any devices are in MAINTENANCE status
            const hasMaintenanceDevice = devices.some(device => 
                device && device.status === 'MAINTENANCE');
            
            // If a device is in maintenance, set room status to 'MAINTENANCE'
            // Otherwise, set it to 'AVAILABLE' (if it was previously in maintenance)
            let statusChanged = false;
            
            if (hasMaintenanceDevice && room.status !== 'MAINTENANCE') {
                room.status = 'MAINTENANCE';
                statusChanged = true;
                console.log(`Setting room ${roomId} status to MAINTENANCE due to device maintenance`);
            } else if (!hasMaintenanceDevice && room.status === 'MAINTENANCE') {
                room.status = 'AVAILABLE';
                statusChanged = true;
                console.log(`Setting room ${roomId} status to AVAILABLE as no devices are in maintenance`);
            }
            
            // Update the room if status changed
            if (statusChanged) {
                await room.update();
                console.log(`Room ${roomId} status updated to ${room.status}`);
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Error updating room status based on devices:', error);
            return false;
        }
    }
}

module.exports = Room;