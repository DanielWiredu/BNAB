/*
    ============================================================================
    Migrate Weekly (and Monthly) processing to store COMPUTED report figures
    instead of raw rates/percentages — mirroring the change already made to
    spProcessDailyReq.

    Principle (from spProcessDailyReq):
      The INSERT into the tblApprove* table now stores the final money amounts
      the reports display (Basic pay, Overtime, Night, Transport, SSF, PF, taxes,
      Vat/GetFund/NHIL, Net, Loan) rather than the raw rates/percentages, so the
      Next.js reports read stored columns directly with no formulas.

    Kept RAW (flat amounts / employer setup inputs, same as Daily):
      UnionDues, Welfare, Medicals, Premium* , Subsidy, PPEMedical, Bussing,
      and all *DLE rate columns.

    NET-OF-LOAN (per decision):
      Like spProcessDailyReq, NetTotal is now stored NET OF LOAN
      (set @netTotal = @netTotal - @totRepayAmount, after the loan block). The
      loan is still stored separately as well (UnionLoan / Loans). This changes
      the original Weekly/Monthly behaviour, which stored NetTotal before loan.

    MONTHLY SCOPE (per decision — "skip Incentive/Night/Gross"):
      tblApproveMonthly has no columns for the computed Incentive/Night/Gross
      amounts, so the EARNING side stays report-derived. Consequently the earning
      RATE columns must remain raw (BasicRate=@dbWage, OTWkday/OTWkendRate=raw OT
      rates, TransportAmount=raw transport rate) because the report derives Basic/
      Incentive/Night/Gross from those raw rates. Only the deduction, employer-cost,
      tax, Vat/GetFund/NHIL, Net and Loan columns are migrated to computed amounts.
    ============================================================================
*/

USE [LamsDbTadi]
GO

-- ===========================================================================
-- WEEKLY
-- ===========================================================================
ALTER PROCEDURE [dbo].[spProcessWeeklyReq]
	@startdate datetime,
	@enddate datetime,
	@processedby varchar(50),
	@processedCostSheets int output
AS
BEGIN
	SET NOCOUNT ON;

	declare @ReqNo varchar(10)
	declare @workerId varchar(10)
	declare @dleCompanyId int
	declare @tradegroupId int
	declare @tradetypeId int
	declare @reportingPointId int
	declare @locationId int
	declare @job varchar(50)
	declare @date datetime
	declare @adate datetime
	declare @preparedby varchar(50)
	declare @approved bit
	declare @approvedby varchar(50)
	declare @dbWage float
	declare @dbWageWkend float
	declare @hrOtimeWkday float
	declare @hrOtimeWkend float
	declare @naWkday float
	declare @naWkend float
	declare @transportRate_Amt float
	declare @dbWageDLE float
	declare @dbWageWkendDLE float
	declare @hrOtimeWkdayDLE float
	declare @hrOtimeWkendDLE float
	declare @naWkdayDLE float
	declare @naWkendDLE float
	declare @subsidy float
	declare @ppeMedical float
	declare @bussing float
	declare @bankId int
	declare @bankBranchId int
	declare @bankBranch varchar(50)
	declare @bankNumber varchar(30)
	declare @tax bit
	declare @chargePremium bit
	declare @ezwich varchar(50)
	declare @age int

	declare @subStaffId int
	declare @transdate datetime
	declare @normal float
	declare @overtime float
	declare @night varchar(5)
	declare @weekends varchar(7)
	declare @holiday varchar(7)
	declare @remarks varchar(50)
	declare @vesselId int
	declare @transport char
	declare @onboardallowance bit

	--payroll setup--
	declare @uniondues float
	declare @welfare float
	declare @medicals float
	declare @ssfEmployee float
	declare @ssfEmployer float
	declare @pfEmployee float
	declare @pfEmployer float
	declare @annualbonus float
	declare @annualleave float
	declare @premShareholder float
	declare @premNonShareholder float
	declare @premWithoutTT float
	declare @taxOnbonus float
	declare @taxOnbasic float
	declare @taxOnovertime float
	declare @taxOnPF float
	declare @taxOntransport float
	declare @onboardallowanceAmt float
	declare @vat float
	declare @getfund float
	declare @nhil float

	declare @dleCompanyStatus varchar(50)

	declare @batchNo int
	declare @approvedOnboardAllowanceAmt float
	declare @basicRate float
	declare @overtimeRate float
	declare @nightRate float
	declare @basicRateDLE float
	declare @overtimeRateDLE float
	declare @nightRateDLE float

	declare @netTotal float = 0.00
	declare @rptBasic float
	declare @rptOvertime float
	declare @rptNight float
	declare @rptTransport float
	declare @rptPFee float
	declare @rptSSFee float
	declare @rptTaxBasic float
	declare @rptTaxOvertime float
	declare @rptTaxPF float
	declare @rptTaxTransport float
	declare @rptGross float

	-- NEW: invoice figures (employer contributions + premium-based charges),
	--      mirroring the "calculate invoice" block in spProcessDailyReq --
	declare @rptSSFer float
	declare @rptPFer float
	declare @rptLeave float
	declare @rptBonus float
	declare @rptPremium float
	declare @rptGetFund float
	declare @rptNHIL float
	declare @rptVat float
	declare @rptTaxBonusLeave float

	set @processedCostSheets = 0

	set @batchNo = (select ISNULL(max(AutoNum),0) from tblApproveWeekly)
	set @batchNo = @batchNo + 1

	-- get approved cost sheets within selected date range --
	select ReqNo into #costsheets from tblStaffWReq where Processed = 0 and Approved=1 and (Adate between @startdate and @enddate)
	select @ReqNo = MIN(ReqNo) from #costsheets
	-- loop through requisition numbers (Cost Sheet)
	while @ReqNo is not null
	begin
		--get Requisition details--
		select @workerId=WorkerID, @dleCompanyId=DLEcodeCompanyID, @tradegroupId=TradegroupID, @tradetypeId=TradetypeID,
			@reportingPointId=ReportpointID, @locationId=locationID, @job=job, @date=date_, @adate=Adate, @preparedby=Preparedby,
			@approved=Approved, @approvedby=Approvedby from tblStaffWReq where ReqNo=@ReqNo

		select @dbWage=DBWage, @dbWageWkend=DBWageWkend, @hrOtimeWkday=HourOtimeWkday, @hrOtimeWkend=HourOtimeWkend,
			@naWkday=NAWkday, @naWkend=NAWkend, @transportRate_Amt=TransportAmount, @dbWageDLE=DBWageDLE, @dbWageWkendDLE=DBWageWkendDLE,
			@hrOtimeWkdayDLE=HourOtimeWkdayDLE, @hrOtimeWkendDLE=HourOtimeWkendDLE, @naWkdayDLE=NAWkdayDLE,
			@naWkendDLE=NAWkendDLE, @subsidy=Subsidy, @ppeMedical=PPEMedical, @bussing=Bussing,
			@bankId=BankID, @bankBranchId=BankBranchId, @bankBranch=BankBranch, @bankNumber=BankNumber, @tax=Tax, @chargePremium=ChargePremium, @ezwich=ezwichid, @age=Age
			from vwStaffWReqGangRates where ReqNo=@ReqNo and EffectiveDate <= @adate and (EndDate >= @adate or EndDate is null)

		-- begin get payroll setting --
		select @uniondues=UnionDues, @welfare=Welfare, @medicals=Medicals, @ssfEmployee=SSFemployee, @ssfEmployer=SSFemployer, @pfEmployee=ProvidentFundEmployee,
			@pfEmployer=ProvidentFundEmployer, @annualbonus=AnnualBonus, @annualleave=AnnualLeave, @premShareholder=PremiumShareHolder,
			@premNonShareholder=PremiumNonShareHolder, @premWithoutTT=PremiumWithoutTT, @taxOnbonus=TaxOnBonus, @taxOnbasic=TaxOnBasic,
			@taxOnovertime=TaxOnOvertime, @taxOnPF=TaxOnProvidentFund, @taxOntransport=TaxOnTransport,
			@onboardallowanceAmt=OnBoardAllowance, @vat=Vat, @getfund=GetFund, @nhil=NHIL from tblPayrollSetup where EffectiveDate <= @adate and (EndDate >= @adate or EndDate is null)
		-- end get payroll setting --

		-- override @premWithoutTT from Payroll Setup with specific DLE premium --
		select @dleCompanyStatus=Pattern, @premWithoutTT=SharePerc from tblDLECompany where DLEcodeCompanyID=@dleCompanyId

		-- get transaction dates on requisition --
		select @subStaffId = min(AutoId) from tblSubStaffWReq where ReqNo = @ReqNo
		-- loop through transaction dates --
		while @subStaffId is not null
		begin
			-- get transaction date details --
			select @transdate=TransDate, @normal=Normal, @overtime=Overtime, @night=Night, @weekends=Weekends, @holiday=Holiday,
				@remarks=Remarks, @vesselId=VesselberthID, @transport=Transport, @onboardallowance=OnBoardAllowance from tblSubStaffWReq where AutoId = @subStaffId

			if (@weekends = 'Weekend') --weekend--
			begin
				set @basicRate = @dbWageWkend
				set @overtimeRate = @hrOtimeWkend
				set @nightRate = @naWkend

				set @basicRateDLE = @dbWageWkendDLE
				set @overtimeRateDLE = @hrOtimeWkendDLE
				set @nightRateDLE = @naWkendDLE
			end
			else						--weekday--
			begin
				set @basicRate = @dbWage
				set @overtimeRate = @hrOtimeWkday
				set @nightRate = @naWkday

				set @basicRateDLE = @dbWageDLE
				set @overtimeRateDLE = @hrOtimeWkdayDLE
				set @nightRateDLE = @naWkdayDLE
			end

			if (@onboardallowance = 1)
				set @approvedOnboardAllowanceAmt = @onboardallowanceAmt
			else
				set @approvedOnboardAllowanceAmt = 0

			-- begin calculate net total --
			set @rptBasic = @basicRate * (@normal / 8)
			if (@weekends = 'Weekend')
				set @rptOvertime = ((@overtime + @normal) * @overtimeRate) - @rptBasic
			else
				set @rptOvertime = @overtime * @overtimeRate
			if (@night = 'Night')
				set @rptNight = @nightRate
			else
				set @rptNight = 0
			if (@transport = '*')
				set @rptTransport = @transportRate_Amt + @approvedOnboardAllowanceAmt
			else
				set @rptTransport = 0
			set @rptPFee = @pfEmployee * @rptBasic
			if (@age < 60)
				set @rptSSFee = @ssfEmployee * @rptBasic
			else
				set @rptSSFee = 0
			set @rptTaxBasic = (@rptBasic - @rptSSFee) * @taxOnbasic
			set @rptTaxOvertime = @rptOvertime * @taxOnovertime
			set @rptTaxPF = (@pfEmployer * @rptBasic) * @taxOnPF
			set @rptTaxTransport = @rptTransport * @taxOntransport
			set @rptGross = @rptBasic + @rptOvertime + @rptNight + @rptTransport
			set @netTotal = @rptGross - (@welfare + @medicals + @uniondues + @rptPFee + @rptSSFee + @rptTaxBasic + @rptTaxOvertime + @rptTaxPF + @rptTaxTransport)
			-- end calculate net total --

			-- begin calculate invoice (NEW: mirror spProcessDailyReq) --
			set @rptPFer = @pfEmployer * @rptBasic
			if (@age < 60)
				set @rptSSFer = @ssfEmployer * @rptBasic
			else
				set @rptSSFer = 0
			set @rptLeave = @annualleave * @rptBasic
			set @rptBonus = @annualbonus * @rptBasic
			set @rptPremium = @premWithoutTT * @rptBasic
			set @rptGetFund = @rptPremium * @getfund
			set @rptNHIL = @rptPremium * @nhil
			set @rptVat = @rptPremium * @vat
			set @rptTaxBonusLeave = @taxOnbonus * (@rptBonus + @rptLeave)
			-- end calculate invoice --

			-- begin loan processing --
			declare @loanNo varchar(20) = null
			declare @repayAmount float
			declare @totRepayAmount float = 0.0
			declare @loanBalance float

			declare @monthlyLimit float
			declare @monthlyRepaid float
			declare @monthlyBalance float

			declare @noOfLoans int
			declare @totExpRepayAmount float
			select @noOfLoans = isnull(count(LoanNo),0), @totExpRepayAmount = isnull(sum(RepayAmount),0.0) from tblLoans where WorkerId = @workerId and LoanBalance > 0 and AutoDeduct = 1 and Approved = 1 and getutcdate() >= ApprovedDate
			if (@noOfLoans > 0)
			begin
				select @loanNo = min(LoanNo) from tblLoans where WorkerId = @workerId and LoanBalance > 0 and AutoDeduct = 1 and Approved = 1 and getutcdate() >= ApprovedDate
				while @loanNo is not null
				begin
					select @repayAmount = isnull(RepayAmount,0.0), @loanBalance = isnull(LoanBalance,0.0), @monthlyLimit = isnull(MonthlyLimit,0.0) from tblLoans where LoanNo = @loanNo
					select @monthlyRepaid = isnull(sum(RepayAmount),0.0) from tblLoanRepayments where LoanNo = @loanNo and month(ApprovedDate) = month(@adate) and year(ApprovedDate) = year(@adate) and Approved = 1

					if (@monthlyLimit > 0) -- monthly limit is set
					begin
						set @monthlyBalance = @monthlyLimit - @monthlyRepaid
						if (@totExpRepayAmount > @netTotal)
							set @repayAmount = floor(@netTotal) / @noOfLoans
						if (@loanBalance <= @repayAmount and @loanBalance <= @monthlyBalance)
							set @repayAmount = @loanBalance
						else if (@monthlyBalance <= @repayAmount and @monthlyBalance > 0)
							set @repayAmount = @monthlyBalance
						else if (@monthlyBalance <= 0.0)
							set @repayAmount = 0.0
					end
					else	-- monthly limit is NOT set
					begin
						if (@totExpRepayAmount > @netTotal)
							set @repayAmount = floor(@netTotal) / @noOfLoans
						if (@loanBalance <= @repayAmount)
							set @repayAmount = @loanBalance
					end

					if (@repayAmount > 0)
					begin
						insert into tblLoanRepayments(LoanNo,WorkerId,RepayDate,RepayAmount,ReqNo,CreatedBy,Approved,ApprovedDate,ApprovedBy)
						values (@loanNo,@workerId,@adate,@repayAmount,@ReqNo,@processedby,1,@adate,@processedby)
						set @totRepayAmount = @totRepayAmount + @repayAmount
					end

					--next loan--
					select @loanNo = min(LoanNo) from tblLoans where WorkerId = @workerId and LoanBalance > 0 and AutoDeduct = 1 and Approved = 1 and getutcdate() >= ApprovedDate and LoanNo > @loanNo
				end
			end
			-- end loan processing --

			-- NetTotal net-of-loan, matching spProcessDailyReq --
			set @netTotal = @netTotal - @totRepayAmount

			-- process Cost Sheet --
			INSERT INTO tblApproveWeekly
				(AutoNum, ReqNo, DLEcodeCompanyID, WorkerID, TradegroupID, TradetypeID, ReportpointID, job, date_, Adate, Preparedby, Approved, Approvedby, Processed,
				 Processedby, TransDate, Normal, Overtime, Night, Weekends, Holiday,
				 Subsidy, PPEMedical, Bussing, UnionDues, Welfare, Medicals, SSFemployee, SSFemployer, ProvidentFundEmployee, ProvidentFundEmployer, AnnualBonus,
				 AnnualLeave, PremiumShareHolder, PremiumNonShareHolder, PremiumWithoutTT, TaxOnBonus, TaxOnBasic, TaxOnOvertime, TaxOnProvidentFund, BasicRate, OvertimeRate, NightRate, BasicRateDLE,
				 OvertimeRateDLE, NightRateDLE, PresentAge, ProcessedDate, StartDate, EndDate, TaxOnTransport, DLEcompanyStatus, transport, TransportAmount, VesselberthID, BankID, BankBranchId, BankBranch, BankNumber, NetTotal,
				 ezwichid, Vat, GetFund, NHIL, OnBoardAllowance, UnionLoan)
			VALUES	(@batchNo, @ReqNo, @dleCompanyId, @workerId, @tradegroupId, @tradetypeId, @reportingPointId, @job, @date, @adate, @preparedby, @approved, @approvedby, 1,
				 @processedby, @transdate, @normal, @overtime, @night, @weekends, @holiday,
				 @subsidy, @ppeMedical, @bussing, @uniondues, @welfare, @medicals, @rptSSFee, @rptSSFer, @rptPFee, @rptPFer, @rptBonus,
				 @rptLeave, @premShareholder, @premNonShareholder, @premWithoutTT, @rptTaxBonusLeave, @rptTaxBasic, @rptTaxOvertime, @rptTaxPF, @rptBasic, @rptOvertime, @rptNight, @basicRateDLE,
				 @overtimeRateDLE, @nightRateDLE, @age, GETUTCDATE(), @startdate, @enddate, @rptTaxTransport, @dleCompanyStatus, @transport, @rptTransport, @vesselId, @bankId, @BankBranchId, @bankBranch, @bankNumber, @netTotal,
				 @ezwich, @rptVat, @rptGetFund, @rptNHIL, @approvedOnboardAllowanceAmt, @totRepayAmount)

			-- next transaction date --
			select @subStaffId = min(AutoId) from tblSubStaffWReq where ReqNo = @ReqNo and AutoId > @subStaffId
		end

		-- update Cost Sheet Status --
		update tblStaffWReq set Processed = 1, Processedby = @processedby where ReqNo = @ReqNo

		set @processedCostSheets = @processedCostSheets + 1 -- count processed cost sheets --

		--next reqno (Cost Sheet)
		select @ReqNo = MIN(ReqNo) from #costsheets where ReqNo > @ReqNo
	end

	drop table #costsheets

	-- save audit trail
	if (@processedCostSheets > 0)
	begin
		declare @actiondate datetime
		declare @actiondescription varchar(100)
		set @actiondate = getdate()
		set @actiondescription = 'PROCESS WEEKLY PAYROLL ' + convert(varchar(10),@startdate,103) + ' to ' + convert(varchar(10),@enddate,103)
		exec spAddAuditTrail @actiondate=@actiondate, @actionby=@processedby, @actiondescription=@actiondescription, @actionid=@batchNo
	end
END
GO

-- ===========================================================================
-- MONTHLY
--   Per decision: skip Incentive/Night/Gross (no storage columns), so the
--   earning RATE columns stay raw and the earning figures remain report-derived.
--   Migrated to computed amounts: UnionDues, Welfare, Medicals, SSF (ee/er),
--   ProvidentFund (ee/er), AnnualBonus, AnnualLeave, TaxOnBonus, TaxOnBasic,
--   TaxOnProvidentFund, Vat, GetFund, NHIL, NetTotal (net of loan), Loans.
--   Left raw (flag): TaxOnOvertime, TaxOnTransport — the Monthly model computes
--   a single tax on taxable pay, not per-component OT/transport taxes.
-- ===========================================================================
ALTER PROCEDURE [dbo].[spProcessMonthlyReq]
	@startdate datetime,
	@enddate datetime,
	@processedby varchar(50),
	@processedCostSheets int output
AS
BEGIN
	SET NOCOUNT ON;

	declare @ReqNo varchar(10)
	declare @dleCompanyId int
	declare @workerId varchar(10)
	declare @tradegroupId int
	declare @tradetypeId int
	declare @reportingPointId int
	declare @locationId int
	declare @job varchar(50)
	declare @date datetime
	declare @adate datetime
	declare @preparedby varchar(50)
	declare @approved bit
	declare @approvedby varchar(50)

	declare @DWkday int
	declare @DWkend int
	declare @DTotal int
	declare @HRWkday float
	declare @HRWkend float
	declare @NWkday int
	declare @NWkend int
	declare @Yyyymm varchar(6)
	declare @PeriodStart datetime
	declare @PeriodEnd datetime
	declare @transport char

	declare @dbWage float
	declare @hrOtimeWkday float
	declare @hrOtimeWkend float
	declare @transportRate_Amt float
	declare @dbWageDLE float
	declare @hrOtimeWkdayDLE float
	declare @hrOtimeWkendDLE float
	declare @subsidy float
	declare @ppeMedical float
	declare @bussing float
	declare @bankId int
	declare @bankBranchId int
	declare @bankNumber varchar(30)
	declare @tax bit
	declare @chargePremium bit
	declare @ezwich varchar(50)
	declare @age int
	declare @paymentOption varchar(10)

	--payroll setup--
	declare @uniondues float
	declare @welfare float
	declare @medicals float
	declare @ssfEmployee float
	declare @ssfEmployer float
	declare @pfEmployee float
	declare @pfEmployer float
	declare @annualbonus float
	declare @annualleave float
	declare @premShareholder float
	declare @premNonShareholder float
	declare @premWithoutTT float
	declare @taxOnbonus float
	declare @taxOnbasic float
	declare @taxOnovertime float
	declare @taxOnPF float
	declare @taxOntransport float
	declare @onboardallowanceAmt float
	declare @vat float
	declare @getfund float
	declare @nhil float

	declare @dleCompanyStatus varchar(50)

	declare @batchNo int

	declare @netTotal float = 0.00
	declare @rptBasic float
	declare @rptIncentive float
	declare @rptTransport float
	declare @rptNight float
	declare @rptGross float
	declare @rptSSFee float
	declare @rptTaxablePay float
	declare @rptTaxPayable float
	declare @rptUnionDues float
	declare @rptWelfare float
	declare @rptMedicals float
	declare @rptPFee float
	declare @rptTaxPF float
	declare @rptDeductions float

	-- NEW: invoice figures (employer contributions + premium-based charges),
	--      mirroring the "calculate invoice" block in spProcessDailyReq --
	declare @rptSSFer float
	declare @rptPFer float
	declare @rptLeave float
	declare @rptBonus float
	declare @rptPremium float
	declare @rptGetFund float
	declare @rptNHIL float
	declare @rptVat float
	declare @rptTaxBonusLeave float

	set @processedCostSheets = 0

	set @batchNo = (select ISNULL(max(AutoNum),0) from tblApproveMonthly)
	set @batchNo = @batchNo + 1

	-- get approved cost sheets within selected date range --
	select ReqNo into #costsheets from tblStaffMReq where Processed = 0 and Approved=1 and (Adate between @startdate and @enddate)
	select @ReqNo = MIN(ReqNo) from #costsheets
	-- loop through requisition numbers (Cost Sheet)
	while @ReqNo is not null
	begin
		--get Requisition details--
		select @dleCompanyId=DLEcodeCompanyID, @workerId=WorkerID, @tradegroupId=TradegroupID, @tradetypeId=TradetypeID,
			@reportingPointId=ReportpointID, @locationId=locationID, @job=job, @date=date_, @adate=Adate, @preparedby=Preparedby,
			@approved=Approved, @approvedby=Approvedby, @DWkday=DWkday, @DWkend=DWkend, @DTotal=DTotal, @HRWkday=HRWkday, @HRWkend=HRWkend,
			@NWkday=NWkday, @NWkend=NWkend, @Yyyymm=Yyyymm, @PeriodStart=PeriodStart, @PeriodEnd=PeriodEnd, @transport=Transport from tblStaffMReq where ReqNo=@ReqNo

		select @dbWage=DBWage, @hrOtimeWkday=HourOtimeWkday, @hrOtimeWkend=HourOtimeWkend,
			@transportRate_Amt=TransportAmt, @dbWageDLE=DBWageDLE,
			@hrOtimeWkdayDLE=HourOtimeWkdayDLE, @hrOtimeWkendDLE=HourOtimeWkendDLE,
			@subsidy=Subsidy, @ppeMedical=PPEMedical, @bussing=Bussing,
			@bankId=BankID, @bankBranchId=BankBranchId, @bankNumber=BankNumber, @tax=Tax, @chargePremium=ChargePremium, @ezwich=ezwichid, @age=Age, @paymentOption=PaymentOption
			from vwStaffMReqGangRates where ReqNo=@ReqNo and EffectiveDate <= @adate and (EndDate >= @adate or EndDate is null)

		-- begin get payroll setting --
		select @uniondues=UnionDues, @welfare=Welfare, @medicals=Medicals, @ssfEmployee=SSFemployee, @ssfEmployer=SSFemployer, @pfEmployee=ProvidentFundEmployee,
			@pfEmployer=ProvidentFundEmployer, @annualbonus=AnnualBonus, @annualleave=AnnualLeave, @premShareholder=PremiumShareHolder,
			@premNonShareholder=PremiumNonShareHolder, @premWithoutTT=PremiumWithoutTT, @taxOnbonus=TaxOnBonus, @taxOnbasic=TaxOnBasic,
			@taxOnovertime=TaxOnOvertime, @taxOnPF=TaxOnProvidentFund, @taxOntransport=TaxOnTransport,
			@onboardallowanceAmt=OnBoardAllowance, @vat=Vat, @getfund=GetFund, @nhil=NHIL from tblPayrollSetup where EffectiveDate <= @adate and (EndDate >= @adate or EndDate is null)
		-- end get payroll setting --

		-- override @premWithoutTT from Payroll Setup with specific DLE premium --
		select @dleCompanyStatus=Pattern, @premWithoutTT=SharePerc from tblDLECompany where DLEcodeCompanyID=@dleCompanyId

		-- begin calculate net total --
		set @rptBasic = @dbWage * @DTotal
		set @rptIncentive = ((@hrOtimeWkend * @HRWkend) - (@dbWage * @DWkend)) + (@hrOtimeWkday * @HRWkday)
		if (@transport = '*')
			set @rptTransport = @transportRate_Amt * @DTotal
		else
			set @rptTransport = 0
		set @rptNight = ((@dbWage * @NWkday) / 2) + (@dbWage * @NWkend)
		set @rptGross = @rptBasic + @rptIncentive + @rptTransport + @rptNight
		if (@age < 60)
			set @rptSSFee = @ssfEmployee * @rptBasic
		else
			set @rptSSFee = 0
		set @rptTaxablePay = @rptGross - @rptSSFee - @rptNight
		set @rptTaxPayable = @rptTaxablePay * @taxOnbasic
		set @rptUnionDues = @uniondues * @DTotal
		set @rptWelfare = @welfare * @DTotal
		set @rptMedicals = @medicals * @DTotal
		set @rptPFee = @pfEmployee * @rptBasic
		set @rptTaxPF = (@pfEmployer * @rptBasic) * @taxOnPF
		set @rptDeductions = @rptSSFee + @rptTaxPayable + @rptUnionDues + @rptWelfare + @rptMedicals + @rptPFee + @rptTaxPF
		set @netTotal = @rptGross - @rptDeductions
		-- end calculate net total --

		-- begin calculate invoice (NEW: mirror spProcessDailyReq) --
		set @rptPFer = @pfEmployer * @rptBasic
		if (@age < 60)
			set @rptSSFer = @ssfEmployer * @rptBasic
		else
			set @rptSSFer = 0
		set @rptLeave = @annualleave * @rptBasic
		set @rptBonus = @annualbonus * @rptBasic
		set @rptPremium = @premWithoutTT * @rptBasic
		set @rptGetFund = @rptPremium * @getfund
		set @rptNHIL = @rptPremium * @nhil
		set @rptVat = @rptPremium * @vat
		set @rptTaxBonusLeave = @taxOnbonus * (@rptBonus + @rptLeave)
		-- end calculate invoice --

		-- begin loan processing --
		declare @loanNo varchar(20) = null
		declare @repayAmount float
		declare @totRepayAmount float = 0.0
		declare @loanBalance float

		declare @monthlyLimit float
		declare @monthlyRepaid float
		declare @monthlyBalance float

		declare @noOfLoans int
		declare @totExpRepayAmount float
		select @noOfLoans = isnull(count(LoanNo),0), @totExpRepayAmount = isnull(sum(RepayAmount),0.0) from tblLoans where WorkerId = @workerId and LoanBalance > 0 and AutoDeduct = 1 and Approved = 1 and getutcdate() >= ApprovedDate
		if (@noOfLoans > 0)
		begin
			select @loanNo = min(LoanNo) from tblLoans where WorkerId = @workerId and LoanBalance > 0 and AutoDeduct = 1 and Approved = 1 and getutcdate() >= ApprovedDate
			while @loanNo is not null
			begin
				select @repayAmount = isnull(RepayAmount,0.0), @loanBalance = isnull(LoanBalance,0.0), @monthlyLimit = isnull(MonthlyLimit,0.0) from tblLoans where LoanNo = @loanNo
				select @monthlyRepaid = isnull(sum(RepayAmount),0.0) from tblLoanRepayments where LoanNo = @loanNo and month(ApprovedDate) = month(@adate) and year(ApprovedDate) = year(@adate) and Approved = 1

				if (@monthlyLimit > 0) -- monthly limit is set
				begin
					set @monthlyBalance = @monthlyLimit - @monthlyRepaid
					if (@totExpRepayAmount > @netTotal)
						set @repayAmount = floor(@netTotal) / @noOfLoans
					if (@loanBalance <= @repayAmount and @loanBalance <= @monthlyBalance)
						set @repayAmount = @loanBalance
					else if (@monthlyBalance <= @repayAmount and @monthlyBalance > 0)
						set @repayAmount = @monthlyBalance
					else if (@monthlyBalance <= 0.0)
						set @repayAmount = 0.0
				end
				else	-- monthly limit is NOT set
				begin
					if (@totExpRepayAmount > @netTotal)
						set @repayAmount = floor(@netTotal) / @noOfLoans
					if (@loanBalance <= @repayAmount)
						set @repayAmount = @loanBalance
				end

				if (@repayAmount > 0)
				begin
					insert into tblLoanRepayments(LoanNo,WorkerId,RepayDate,RepayAmount,ReqNo,CreatedBy,Approved,ApprovedDate,ApprovedBy)
					values (@loanNo,@workerId,@adate,@repayAmount,@ReqNo,@processedby,1,@adate,@processedby)
					set @totRepayAmount = @totRepayAmount + @repayAmount
				end

				--next loan--
				select @loanNo = min(LoanNo) from tblLoans where WorkerId = @workerId and LoanBalance > 0 and AutoDeduct = 1 and Approved = 1 and getutcdate() >= ApprovedDate and LoanNo > @loanNo
			end
		end
		-- end loan processing --

		-- NetTotal net-of-loan, matching spProcessDailyReq --
		set @netTotal = @netTotal - @totRepayAmount

		-- process Cost Sheet --
		INSERT INTO tblApproveMonthly
			(AutoNum, ReqNo, DLEcodeCompanyID, WorkerID, TradegroupID, TradetypeID, ReportpointID, LocationID, job, date_, Adate, Preparedby, Approved, Approvedby, Processed,
			 Processedby, DWkday, DWkend, DTotal, HRWkday, HRWkend, NWkday, NWkend, Yyyymm, PeriodStart, PeriodEnd, Transport,
			 Subsidy, PPEMedical, Bussing, UnionDues, Welfare, Medicals, SSFemployee, SSFemployer, ProvidentFundEmployee, ProvidentFundEmployer, AnnualBonus,
			 AnnualLeave, PremiumShareHolder, PremiumNonShareHolder, PremiumWithoutTT, TaxOnBonus, TaxOnBasic, TaxOnOvertime, TaxOnTransport, TaxOnProvidentFund, BasicRate, OTWkdayRate, OTWkendRate, BasicRateDLE,
			 OTWkdayRateDLE, OTWkendRateDLE, PresentAge, ProcessedDate, StartDate, EndDate, DLEcompanyStatus, TransportAmount, BankID, BankBranchId, BankNumber, NetTotal,
			 ezwichid, Vat, GetFund, NHIL, OnBoardAllowance, Loans, PaymentOption)
		VALUES	(@batchNo, @ReqNo, @dleCompanyId, @workerId, @tradegroupId, @tradetypeId, @reportingPointId, @locationId, @job, @date, @adate, @preparedby, @approved, @approvedby, 1,
			 @processedby, @DWkday, @DWkend, @DTotal, @HRWkday, @HRWkend, @NWkday, @NWkend, @Yyyymm, @PeriodStart, @PeriodEnd, @transport,
			 @subsidy, @ppeMedical, @bussing, @rptUnionDues, @rptWelfare, @rptMedicals, @rptSSFee, @rptSSFer, @rptPFee, @rptPFer, @rptBonus,
			 @rptLeave, @premShareholder, @premNonShareholder, @premWithoutTT, @rptTaxBonusLeave, @rptTaxPayable, @taxOnovertime, @taxOntransport, @rptTaxPF, @dbWage, @hrOtimeWkday, @hrOtimeWkend, @dbWageDLE,
			 @hrOtimeWkdayDLE, @hrOtimeWkendDLE, @age, GETDATE(), @startdate, @enddate, @dleCompanyStatus, @transportRate_Amt, @bankId, @bankBranchId, @bankNumber, @netTotal,
			 @ezwich, @rptVat, @rptGetFund, @rptNHIL, @onboardallowanceAmt, @totRepayAmount, @paymentOption)

		-- update Cost Sheet Status --
		update tblStaffMReq set Processed = 1, Processedby = @processedby where ReqNo = @ReqNo

		set @processedCostSheets = @processedCostSheets + 1 -- count processed cost sheets --

		--next reqno (Cost Sheet)
		select @ReqNo = MIN(ReqNo) from #costsheets where ReqNo > @ReqNo
	end

	drop table #costsheets

	-- save audit trail
	if (@processedCostSheets > 0)
	begin
		declare @actiondate datetime
		declare @actiondescription varchar(100)
		set @actiondate = getdate()
		set @actiondescription = 'PROCESS MONTHLY PAYROLL ' + convert(varchar(10),@startdate,103) + ' to ' + convert(varchar(10),@enddate,103)
		exec spAddAuditTrail @actiondate=@actiondate, @actionby=@processedby, @actiondescription=@actiondescription, @actionid=@batchNo
	end
END
GO
